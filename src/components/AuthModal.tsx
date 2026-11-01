import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, ArrowRight, AlertCircle } from 'lucide-react';
import {
  firebaseConfig,
  registerWithEmail,
  signInWithEmail,
  signInWithGoogle,
} from '../firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [setupHint, setSetupHint] = useState<string | null>(null);

  if (!isOpen) return null;

  const formatAuthError = (err: unknown) => {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('auth/unauthorized-domain')) {
      setSetupHint(
        `In Firebase Console (${firebaseConfig.projectId}) → Authentication → Settings → Authorized domains, add "${window.location.hostname}".`
      );
      return 'This preview domain is not yet authorized in your Firebase project.';
    }
    if (raw.includes('auth/operation-not-allowed')) {
      setSetupHint(
        `In Firebase Console (${firebaseConfig.projectId}) → Authentication → Sign-in method, enable Google and/or Email/Password authentication.`
      );
      return 'This sign-in provider is not yet enabled in your Firebase project console.';
    }
    if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
      setSetupHint(null);
      return 'Invalid email or password. Please check your credentials or create a new account.';
    }
    if (raw.includes('auth/email-already-in-use')) {
      setSetupHint(null);
      return 'An account with this email already exists. Switch to Sign In below.';
    }
    if (raw.includes('auth/weak-password')) {
      setSetupHint(null);
      return 'Password should be at least 6 characters long.';
    }
    setSetupHint(null);
    return raw;
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    setSetupHint(null);
    try {
      await signInWithGoogle();
      onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSetupHint(null);
    try {
      if (mode === 'register') {
        await registerWithEmail(displayName || 'Lead Planner', email, password);
      } else {
        await signInWithEmail(email, password);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-xl max-w-md w-full overflow-hidden shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 bg-[#FAF8F5] border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg text-stone-900">
              {mode === 'signin'
                ? 'Sign In to Atelier Vela'
                : 'Create Your Planner Account'}
            </h2>
            <p className="text-[11px] text-stone-500 font-mono">
              Firebase Project: {firebaseConfig.projectId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
              }}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
              }}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 space-y-1.5">
              <div className="flex items-start gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
                <span>{errorMsg}</span>
              </div>
              {setupHint && (
                <p className="text-[11px] text-red-800 pl-6 leading-relaxed">{setupHint}</p>
              )}
            </div>
          )}

          {/* Google Sign-In Button */}
          <button
            type="button"
            disabled={submitting}
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 px-4 text-xs font-medium bg-white border border-stone-300 hover:bg-stone-50 text-stone-900 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>Continue with Google Popup</span>
            <ArrowRight className="w-3.5 h-3.5 text-stone-500" />
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-stone-200 w-full" />
            <span className="bg-white px-3 text-[11px] text-stone-400 whitespace-nowrap">
              or with email &amp; password
            </span>
            <div className="border-t border-stone-200 w-full" />
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            {mode === 'register' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700 block">
                  Planner / Host Name
                </label>
                <div className="relative">
                  <UserIcon className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Elena Rostova"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700 block">Email Address</label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="planner@ateliervela.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700 block">Password</label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 text-xs font-medium bg-stone-900 text-stone-50 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting
                ? 'Authenticating...'
                : mode === 'signin'
                ? 'Sign In to Studio'
                : 'Create Planner Profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
