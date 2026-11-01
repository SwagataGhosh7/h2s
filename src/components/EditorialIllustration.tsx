import React from 'react';
import { EventCategory } from '../types';

interface EditorialIllustrationProps {
  category: EventCategory;
  title?: string;
  subtitle?: string;
  className?: string;
}

export const EditorialIllustration: React.FC<EditorialIllustrationProps> = ({
  category,
  title,
  subtitle,
  className = '',
}) => {
  if (category === 'wedding') {
    return (
      <div
        className={`relative overflow-hidden bg-[#1F1D1A] text-[#FAF8F5] flex flex-col justify-between p-6 ${className}`}
      >
        <svg
          viewBox="0 0 600 400"
          className="absolute inset-0 w-full h-full object-cover opacity-80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect width="600" height="400" fill="#1F1D1A" />
          {/* Architectural Courtyard Arches */}
          <path
            d="M70 380V170C70 114.772 114.772 70 170 70C225.228 70 270 114.772 270 170V380"
            stroke="#D6CEBF"
            strokeWidth="1.5"
            strokeOpacity="0.45"
          />
          <path
            d="M330 380V170C330 114.772 374.772 70 430 70C485.228 70 530 114.772 530 170V380"
            stroke="#D6CEBF"
            strokeWidth="1.5"
            strokeOpacity="0.45"
          />
          {/* Long Linen Banquet Table Perspective */}
          <path
            d="M140 380L245 220H355L460 380H140Z"
            fill="#2B2723"
            stroke="#E7DFD3"
            strokeWidth="1.2"
            strokeOpacity="0.6"
          />
          {/* Tapered Beeswax Candles & Warm Glows */}
          <circle cx="270" cy="245" r="22" fill="#D99B52" fillOpacity="0.18" />
          <circle cx="330" cy="245" r="22" fill="#D99B52" fillOpacity="0.18" />
          <circle cx="250" cy="300" r="28" fill="#D99B52" fillOpacity="0.22" />
          <circle cx="350" cy="300" r="28" fill="#D99B52" fillOpacity="0.22" />
          <line x1="270" y1="248" x2="270" y2="275" stroke="#F5EFE6" strokeWidth="2" />
          <line x1="330" y1="248" x2="330" y2="275" stroke="#F5EFE6" strokeWidth="2" />
          <line x1="250" y1="302" x2="250" y2="338" stroke="#F5EFE6" strokeWidth="2.5" />
          <line x1="350" y1="302" x2="350" y2="338" stroke="#F5EFE6" strokeWidth="2.5" />
          <circle cx="270" cy="243" r="3" fill="#FBBF24" />
          <circle cx="330" cy="243" r="3" fill="#FBBF24" />
          <circle cx="250" cy="297" r="3.5" fill="#FBBF24" />
          <circle cx="350" cy="297" r="3.5" fill="#FBBF24" />
        </svg>
        <div className="relative z-10 flex items-center justify-between text-xs text-stone-300">
          <span>Architectural Courtyard Plate</span>
          <span aria-hidden="true">·</span>
          <span>Wedding Production</span>
        </div>
        {title && (
          <div className="relative z-10 mt-auto pt-12">
            <p className="font-display text-xl text-stone-50 leading-snug">{title}</p>
            {subtitle && <p className="text-xs text-stone-300 mt-1">{subtitle}</p>}
          </div>
        )}
      </div>
    );
  }

  if (category === 'birthday') {
    return (
      <div
        className={`relative overflow-hidden bg-[#261C18] text-[#FAF8F5] flex flex-col justify-between p-6 ${className}`}
      >
        <svg
          viewBox="0 0 600 400"
          className="absolute inset-0 w-full h-full object-cover opacity-80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect width="600" height="400" fill="#261C18" />
          {/* Sculptural Botanical & Gallery Window Grid */}
          <rect
            x="60"
            y="40"
            width="480"
            height="320"
            stroke="#E5D5C5"
            strokeOpacity="0.25"
            strokeWidth="1"
          />
          <circle
            cx="300"
            cy="210"
            r="110"
            fill="#3B2922"
            stroke="#E5D5C5"
            strokeOpacity="0.5"
            strokeWidth="1.5"
          />
          {/* Ikebana Floral Stem Geometry */}
          <path
            d="M300 320C300 250 250 180 210 130"
            stroke="#D97757"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M300 320C305 240 355 175 390 115"
            stroke="#E5C185"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="210" cy="130" r="14" fill="#D97757" fillOpacity="0.85" />
          <circle cx="390" cy="115" r="18" fill="#E5C185" fillOpacity="0.75" />
          <circle cx="315" cy="165" r="10" fill="#F5EBE1" fillOpacity="0.9" />
          {/* Coupe Glassware Silhouettes */}
          <path
            d="M170 280H210L190 305V335M175 335H205"
            stroke="#F5EBE1"
            strokeWidth="1.5"
            strokeOpacity="0.7"
          />
          <path
            d="M390 280H430L410 305V335M395 335H425"
            stroke="#F5EBE1"
            strokeWidth="1.5"
            strokeOpacity="0.7"
          />
        </svg>
        <div className="relative z-10 flex items-center justify-between text-xs text-stone-300">
          <span>Private Supper & Salon Plate</span>
          <span aria-hidden="true">·</span>
          <span>Milestone Birthday</span>
        </div>
        {title && (
          <div className="relative z-10 mt-auto pt-12">
            <p className="font-display text-xl text-stone-50 leading-snug">{title}</p>
            {subtitle && <p className="text-xs text-stone-300 mt-1">{subtitle}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-[#18221F] text-[#FAF8F5] flex flex-col justify-between p-6 ${className}`}
    >
      <svg
        viewBox="0 0 600 400"
        className="absolute inset-0 w-full h-full object-cover opacity-80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="600" height="400" fill="#18221F" />
        {/* Timber & Glass Pavilion Roof Truss */}
        <path
          d="M40 160L300 60L560 160"
          stroke="#CBD5C0"
          strokeWidth="2"
          strokeOpacity="0.55"
        />
        <path
          d="M90 160V350M230 160V350M370 160V350M510 160V350"
          stroke="#CBD5C0"
          strokeWidth="1.2"
          strokeOpacity="0.35"
        />
        {/* Festoon String Lights Catenary Curves */}
        <path
          d="M90 180Q160 215 230 180Q300 215 370 180Q440 215 510 180"
          stroke="#FDE68A"
          strokeWidth="1.2"
          strokeOpacity="0.6"
        />
        <circle cx="160" cy="198" r="4" fill="#FDE68A" />
        <circle cx="300" cy="198" r="4" fill="#FDE68A" />
        <circle cx="440" cy="198" r="4" fill="#FDE68A" />
        {/* Communal Tables */}
        <rect
          x="130"
          y="290"
          width="140"
          height="36"
          stroke="#CBD5C0"
          strokeOpacity="0.6"
          fill="#22302C"
        />
        <rect
          x="330"
          y="290"
          width="140"
          height="36"
          stroke="#CBD5C0"
          strokeOpacity="0.6"
          fill="#22302C"
        />
      </svg>
      <div className="relative z-10 flex items-center justify-between text-xs text-stone-300">
        <span>Pavilion & Civic Gathering Plate</span>
        <span aria-hidden="true">·</span>
        <span>Community Gala</span>
      </div>
      {title && (
        <div className="relative z-10 mt-auto pt-12">
          <p className="font-display text-xl text-stone-50 leading-snug">{title}</p>
          {subtitle && <p className="text-xs text-stone-300 mt-1">{subtitle}</p>}
        </div>
      )}
    </div>
  );
};
