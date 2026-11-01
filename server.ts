import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getAiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface PresenceClient {
  ws: WebSocket;
  userId: string;
  displayName: string;
  role: string;
  eventId: string;
  activeTab: string;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const httpServer = createServer(app);

  // ===========================================================================
  // Real-time WebSocket Collaboration & Presence Server
  // ===========================================================================
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/collab' });
  const clients = new Map<WebSocket, PresenceClient>();

  function broadcastRoomPresence(eventId: string) {
    const roomUsers: Array<{
      userId: string;
      displayName: string;
      role: string;
      activeTab: string;
    }> = [];
    const seenIds = new Set<string>();

    for (const info of clients.values()) {
      if (info.eventId === eventId && !seenIds.has(info.userId)) {
        seenIds.add(info.userId);
        roomUsers.push({
          userId: info.userId,
          displayName: info.displayName,
          role: info.role,
          activeTab: info.activeTab,
        });
      }
    }

    const payload = JSON.stringify({
      type: 'presence:sync',
      eventId,
      participants: roomUsers,
    });

    for (const [clientWs, info] of clients.entries()) {
      if (info.eventId === eventId && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(payload);
      }
    }
  }

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'room:join' && msg.eventId && msg.userId) {
          const prev = clients.get(ws);
          const prevEventId = prev?.eventId;
          clients.set(ws, {
            ws,
            userId: String(msg.userId).slice(0, 128),
            displayName: String(msg.displayName || 'Planner').slice(0, 80),
            role: String(msg.role || 'planner').slice(0, 20),
            eventId: String(msg.eventId).slice(0, 128),
            activeTab: String(msg.activeTab || 'overview').slice(0, 40),
          });
          if (prevEventId && prevEventId !== msg.eventId) {
            broadcastRoomPresence(prevEventId);
          }
          broadcastRoomPresence(String(msg.eventId));
        } else if (msg.type === 'focus:changed') {
          const current = clients.get(ws);
          if (current) {
            current.activeTab = String(msg.activeTab || 'overview').slice(0, 40);
            broadcastRoomPresence(current.eventId);
          }
        } else if (msg.type === 'activity:pulse') {
          const current = clients.get(ws);
          if (current) {
            const pulsePayload = JSON.stringify({
              type: 'activity:pulse',
              eventId: current.eventId,
              id: String(msg.id || Date.now()),
              actorName: current.displayName,
              summary: String(msg.summary || 'updated the workspace').slice(0, 160),
              timestamp: new Date().toISOString(),
            });
            for (const [clientWs, info] of clients.entries()) {
              if (info.eventId === current.eventId && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(pulsePayload);
              }
            }
          }
        }
      } catch {
        // Ignore malformed socket payloads
      }
    });

    ws.on('close', () => {
      const existing = clients.get(ws);
      clients.delete(ws);
      if (existing) {
        broadcastRoomPresence(existing.eventId);
      }
    });
  });

  // ===========================================================================
  // GenAI Endpoint 1: Generate Complete Celebration Blueprint
  // ===========================================================================
  app.post('/api/ai/generate-blueprint', async (req, res) => {
    try {
      const {
        title,
        category,
        eventDate,
        location,
        guestCountEstimate,
        totalBudgetLimit,
        styleBrief,
      } = req.body || {};

      const ai = getAiClient();
      const prompt = `You are a Principal Celebration Architect at Atelier Vela.
Design a complete, realistic, production-grade event blueprint for the following celebration:
- Title: ${title || 'Bespoke Celebration'}
- Category: ${category || 'wedding'} (must be tailored to wedding, birthday, or community event)
- Date: ${eventDate || '2027-06-15'}
- Location / Venue Context: ${location || 'San Francisco Conservatory'}
- Estimated Guest Count: ${guestCountEstimate || 85}
- Target Total Budget (USD): $${totalBudgetLimit || 35000}
- Aesthetic & Vision Brief: ${styleBrief || 'Warm architectural minimalism, seasonal culinary program, intimate acoustic atmosphere'}

Requirements:
1. All budget items estimatedAmount values must be realistic numbers that sum up to roughly 85%-98% of the Target Total Budget ($${totalBudgetLimit || 35000}).
2. Provide 5 budget items covering categories from: venue, catering, decor, music, attire, logistics.
3. Provide 5 chronological timeline items covering phases from: pre_event, setup, ceremony_main, reception, wrap_up.
4. Provide 4 vendor checklist items covering serviceTypes from: venue, catering, floral_decor, photography, entertainment, rentals.
5. Provide 4 personalized idea cards covering pillars from: atmosphere, culinary, guest_experience, floral_lighting, music_ritual.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            'Return strictly valid JSON adhering to the schema. Keep strings concise, specific, and editorial.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              refinedStyleBrief: {
                type: Type.STRING,
                description: 'Refined 2-sentence architectural and sensory direction (max 450 chars).',
              },
              budgetItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    category: {
                      type: Type.STRING,
                      description: 'One of: venue, catering, decor, music, attire, logistics',
                    },
                    estimatedAmount: { type: Type.NUMBER },
                    actualAmount: { type: Type.NUMBER },
                    paymentStatus: {
                      type: Type.STRING,
                      description: 'One of: planned, deposit_paid, paid_in_full',
                    },
                    notes: { type: Type.STRING },
                  },
                  required: [
                    'title',
                    'category',
                    'estimatedAmount',
                    'actualAmount',
                    'paymentStatus',
                    'notes',
                  ],
                },
              },
              timelineItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    timeSlot: { type: Type.STRING },
                    title: { type: Type.STRING },
                    phase: {
                      type: Type.STRING,
                      description: 'One of: pre_event, setup, ceremony_main, reception, wrap_up',
                    },
                    leadPerson: { type: Type.STRING },
                    status: {
                      type: Type.STRING,
                      description: 'One of: upcoming, in_progress, completed',
                    },
                    notes: { type: Type.STRING },
                  },
                  required: ['timeSlot', 'title', 'phase', 'leadPerson', 'status', 'notes'],
                },
              },
              vendors: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    vendorName: { type: Type.STRING },
                    serviceType: {
                      type: Type.STRING,
                      description:
                        'One of: venue, catering, floral_decor, photography, entertainment, rentals',
                    },
                    contractStatus: {
                      type: Type.STRING,
                      description: 'One of: researching, shortlisted, contracted, confirmed',
                    },
                    quotedPrice: { type: Type.NUMBER },
                    contactPerson: { type: Type.STRING },
                    deliverableNotes: { type: Type.STRING },
                  },
                  required: [
                    'vendorName',
                    'serviceType',
                    'contractStatus',
                    'quotedPrice',
                    'contactPerson',
                    'deliverableNotes',
                  ],
                },
              },
              ideas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    pillar: {
                      type: Type.STRING,
                      description:
                        'One of: atmosphere, culinary, guest_experience, floral_lighting, music_ritual',
                    },
                    description: { type: Type.STRING },
                    estimatedCostImpact: { type: Type.STRING },
                  },
                  required: ['title', 'pillar', 'description', 'estimatedCostImpact'],
                },
              },
            },
            required: ['refinedStyleBrief', 'budgetItems', 'timelineItems', 'vendors', 'ideas'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate AI blueprint';
      res.status(500).json({ error: message });
    }
  });

  // ===========================================================================
  // GenAI Endpoint 2: Personalized Idea & Vendor/Timeline Co-Pilot
  // ===========================================================================
  app.post('/api/ai/ideate', async (req, res) => {
    try {
      const {
        eventTitle,
        category,
        location,
        guestCount,
        totalBudgetLimit,
        currentBudgetCommitted,
        styleBrief,
        userPrompt,
      } = req.body || {};

      const ai = getAiClient();
      const prompt = `Event Context:
- Celebration: ${eventTitle} (${category})
- Location: ${location}
- Guests: ${guestCount}
- Target Budget: $${totalBudgetLimit} (Currently allocated: $${currentBudgetCommitted})
- Style Brief: ${styleBrief}
- Planner Request: "${userPrompt || 'Suggest distinctive, memorable guest experiences and design touches'}"

Generate 3 highly specific, actionable event ideas, 2 suggested timeline cues, and 2 vendor checklist recommendations tailored to this request.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a creative event director. Provide concrete, non-cliche, logistically grounded ideas in JSON.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              advisorNote: {
                type: Type.STRING,
                description: 'Concise editorial synthesis addressing the user request.',
              },
              ideas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    pillar: {
                      type: Type.STRING,
                      description:
                        'One of: atmosphere, culinary, guest_experience, floral_lighting, music_ritual',
                    },
                    description: { type: Type.STRING },
                    estimatedCostImpact: { type: Type.STRING },
                  },
                  required: ['title', 'pillar', 'description', 'estimatedCostImpact'],
                },
              },
              suggestedTimelineCues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    timeSlot: { type: Type.STRING },
                    title: { type: Type.STRING },
                    phase: {
                      type: Type.STRING,
                      description: 'One of: pre_event, setup, ceremony_main, reception, wrap_up',
                    },
                    leadPerson: { type: Type.STRING },
                    notes: { type: Type.STRING },
                  },
                  required: ['timeSlot', 'title', 'phase', 'leadPerson', 'notes'],
                },
              },
              suggestedVendors: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    vendorName: { type: Type.STRING },
                    serviceType: {
                      type: Type.STRING,
                      description:
                        'One of: venue, catering, floral_decor, photography, entertainment, rentals',
                    },
                    quotedPrice: { type: Type.NUMBER },
                    contactPerson: { type: Type.STRING },
                    deliverableNotes: { type: Type.STRING },
                  },
                  required: [
                    'vendorName',
                    'serviceType',
                    'quotedPrice',
                    'contactPerson',
                    'deliverableNotes',
                  ],
                },
              },
            },
            required: ['advisorNote', 'ideas', 'suggestedTimelineCues', 'suggestedVendors'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate AI ideas';
      res.status(500).json({ error: message });
    }
  });

  // ===========================================================================
  // GenAI Endpoint 3: Budget & Production Audit
  // ===========================================================================
  app.post('/api/ai/optimize-budget', async (req, res) => {
    try {
      const { eventTitle, category, guestCount, totalBudgetLimit, budgetItems } = req.body || {};

      const ai = getAiClient();
      const prompt = `Audit the budget ledger for "${eventTitle}" (${category}, ${guestCount} guests, Target Budget Limit: $${totalBudgetLimit}).
Current Line Items:
${JSON.stringify(budgetItems || [], null, 2)}

Provide a concise financial & production audit with concrete savings opportunities, per-guest cost analysis, and suggested new or rebalanced line items.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            'You are an executive event producer and financial controller. Return strictly structured JSON.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING },
              recommendedSavingsUSD: { type: Type.NUMBER },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    headline: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                    suggestedCategory: {
                      type: Type.STRING,
                      description: 'One of: venue, catering, decor, music, attire, logistics',
                    },
                    deltaAmount: { type: Type.NUMBER },
                  },
                  required: ['headline', 'rationale', 'suggestedCategory', 'deltaAmount'],
                },
              },
            },
            required: ['executiveSummary', 'recommendedSavingsUSD', 'recommendations'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to audit budget';
      res.status(500).json({ error: message });
    }
  });

  // Vite middleware in dev / static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Atelier Vela server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
