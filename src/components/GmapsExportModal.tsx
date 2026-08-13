'use client';

import React from 'react';
import { X, QrCode, ChevronRight, ExternalLink, Check, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Point } from '@/db/database';

export interface GmapsSegment {
  segmentIndex: number;
  totalSegments: number;
  points: Point[];
  startPoint: Point;
  endPoint: Point;
  googleMapsUrl: string;
}

interface GmapsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePointsCount: number;
  gmapsSegments: GmapsSegment[];
  copiedSegmentIndex: number | null;
  onCopySegmentLink: (url: string, index: number) => void;
  onOpenExternalUrl: (url: string, e?: React.SyntheticEvent) => void;
}

export default function GmapsExportModal({
  isOpen,
  onClose,
  activePointsCount,
  gmapsSegments,
  copiedSegmentIndex,
  onCopySegmentLink,
  onOpenExternalUrl,
}: GmapsExportModalProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-zinc-950/75 animate-fade-in cursor-pointer"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col space-y-4 animate-scale-up text-left cursor-default overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Nawigacja Google Maps & Kody QR</span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                Trasa liczy {activePointsCount} punktów • Podzielona na {gmapsSegments.length}{' '}
                {gmapsSegments.length === 1 ? 'segment' : 'segmenty'} (max 10 pkt/segment)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body: Responsive Grid of Segments */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div
            className={`grid gap-4 ${
              gmapsSegments.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-1 md:grid-cols-2'
            }`}
          >
            {gmapsSegments.map(segment => {
              const isCopied = copiedSegmentIndex === segment.segmentIndex;
              return (
                <div
                  key={`gmaps-seg-${segment.segmentIndex}`}
                  className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/50 flex flex-col justify-between space-y-4 hover:border-blue-500/50 transition shadow-sm"
                >
                  <div className="space-y-2">
                    {/* Segment Header Badge */}
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-black">
                        Segment #{segment.segmentIndex} z {segment.totalSegments}
                      </span>
                      <span className="text-[11px] font-bold text-zinc-500">
                        {segment.points.length} punktów
                      </span>
                    </div>

                    {/* Segment Start -> End Description */}
                    <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 pt-1 truncate">
                      <span className="text-emerald-600 dark:text-emerald-400 truncate">
                        {segment.startPoint.name}
                      </span>
                      <ChevronRight className="w-4 h-4 flex-shrink-0 text-zinc-400" />
                      <span className="text-blue-600 dark:text-blue-400 truncate">
                        {segment.endPoint.name}
                      </span>
                    </div>
                  </div>

                  {/* QR Code Display Container */}
                  <div className="p-3 bg-white rounded-2xl border border-zinc-200 dark:border-zinc-700/60 shadow-inner flex flex-col items-center justify-center gap-2 self-center">
                    <QRCodeSVG value={segment.googleMapsUrl} size={150} level="M" includeMargin={false} />
                    <span className="text-[10px] font-bold text-zinc-400">Zeskanuj aparatem telefonu</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={e => onOpenExternalUrl(segment.googleMapsUrl, e)}
                      className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Otwórz w Google Maps</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onCopySegmentLink(segment.googleMapsUrl, segment.segmentIndex)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>Skopiowano link!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Kopiuj link do segmentu</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
