import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, ImageUp, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { decodeQrFromImageFile, parseGroupInviteFromQrPayload } from '../lib/qrInvite';
import { ModalDialog } from './RallyComponents';

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onCodeScanned: (groupCode: string) => void;
}

export function QrScannerModal({ open, onClose, onCodeScanned }: QrScannerModalProps) {
  if (!open) return null;
  return <QrScannerModalBody onClose={onClose} onCodeScanned={onCodeScanned} />;
}

function QrScannerModalBody({
  onClose,
  onCodeScanned,
}: {
  onClose: () => void;
  onCodeScanned: (groupCode: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const handledRef = useRef(false);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraStatus, setCameraStatus] = useState<'starting' | 'active' | 'error'>('starting');
  const [statusMessage, setStatusMessage] = useState<string>(
    'Point your camera at a host’s RallyHub QR code.'
  );
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isDecodingFile, setIsDecodingFile] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleDecodedPayload = useCallback(
    (rawPayload: string): boolean => {
      if (handledRef.current) return true;
      const code = parseGroupInviteFromQrPayload(rawPayload);
      if (!code) {
        setWarningMessage(
          'QR code detected, but it does not contain a valid RallyHub invite code.'
        );
        return false;
      }
      handledRef.current = true;
      stopCamera();
      onCodeScanned(code);
      onClose();
      return true;
    },
    [onClose, onCodeScanned, stopCamera]
  );

  useEffect(() => {
    let cancelled = false;
    handledRef.current = false;

    const startCamera = async () => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        if (!cancelled) {
          setCameraStatus('error');
          setStatusMessage(
            'Camera access is unavailable in this browser or context. Upload a QR code screenshot instead.'
          );
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }

        if (!cancelled) {
          setCameraStatus('active');
          setStatusMessage('Point your camera at a host’s RallyHub QR code.');
          setWarningMessage(null);
        }

        let lastScanMs = 0;
        const scanLoop = (timestamp: number) => {
          if (cancelled || handledRef.current) return;
          const v = videoRef.current;
          const c = canvasRef.current;
          if (v && c && v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) {
            if (timestamp - lastScanMs >= 140) {
              lastScanMs = timestamp;
              const targetW = Math.min(720, v.videoWidth);
              const scale = targetW / v.videoWidth;
              const targetH = Math.max(1, Math.round(v.videoHeight * scale));
              if (c.width !== targetW || c.height !== targetH) {
                c.width = targetW;
                c.height = targetH;
              }
              const ctx = c.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(v, 0, 0, targetW, targetH);
                const imgData = ctx.getImageData(0, 0, targetW, targetH);
                const result = jsQR(imgData.data, targetW, targetH, {
                  inversionAttempts: 'attemptBoth',
                });
                if (result?.data) {
                  if (handleDecodedPayload(result.data)) return;
                }
              }
            }
          }
          rafRef.current = window.requestAnimationFrame(scanLoop);
        };

        rafRef.current = window.requestAnimationFrame(scanLoop);
      } catch (err) {
        if (cancelled) return;
        const errName =
          err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
        setCameraStatus('error');
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          setStatusMessage(
            'Camera permission was denied. Allow camera access in browser settings or upload a QR image below.'
          );
        } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          setStatusMessage(
            'No camera was detected on this device. You can upload a QR code image below instead.'
          );
        } else {
          setStatusMessage(
            'Could not start camera preview. You can upload a QR code image below instead.'
          );
        }
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [facingMode, handleDecodedPayload, stopCamera]);

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsDecodingFile(true);
    setWarningMessage(null);
    try {
      const payload = await decodeQrFromImageFile(file);
      if (!payload) {
        setWarningMessage('No QR code was found in that image. Try a clearer crop of the QR code.');
        return;
      }
      handleDecodedPayload(payload);
    } catch {
      setWarningMessage('Could not read the selected image file.');
    } finally {
      setIsDecodingFile(false);
    }
  };

  return (
    <ModalDialog
      open
      onClose={() => {
        stopCamera();
        onClose();
      }}
      title="Scan Group QR Code"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isDecodingFile}
              data-testid="qr_upload_image_button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] px-3 py-2 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)] disabled:opacity-55"
            >
              {isDecodingFile ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageUp className="h-3.5 w-3.5" />
              )}
              <span>Upload QR Image</span>
            </button>
            {cameraStatus === 'active' && (
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setCameraStatus('starting');
                  setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
                }}
                data-testid="qr_switch_camera_button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] px-3 py-2 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Flip Camera</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            data-testid="qr_scanner_cancel_button"
            className="rounded-xl px-3.5 py-2 text-xs font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
          >
            Cancel
          </button>
        </div>
      }
    >
      <div data-testid="qr_scanner_modal" className="space-y-3">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[var(--rally-outline)] bg-slate-950">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`h-full w-full object-cover ${
              cameraStatus === 'active' ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {cameraStatus === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-white/90">
              <Loader2 className="h-7 w-7 animate-spin text-[var(--rally-primary)]" />
              <span className="text-xs font-medium">Starting camera...</span>
            </div>
          )}

          {cameraStatus === 'active' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="relative h-44 w-44 rounded-2xl border-2 border-white/35 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)] sm:h-52 sm:w-52">
                <span className="absolute -left-0.5 -top-0.5 h-6 w-6 rounded-tl-xl border-l-4 border-t-4 border-[var(--rally-secondary)]" />
                <span className="absolute -right-0.5 -top-0.5 h-6 w-6 rounded-tr-xl border-r-4 border-t-4 border-[var(--rally-secondary)]" />
                <span className="absolute -bottom-0.5 -left-0.5 h-6 w-6 rounded-bl-xl border-b-4 border-l-4 border-[var(--rally-secondary)]" />
                <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-br-xl border-b-4 border-r-4 border-[var(--rally-secondary)]" />
              </div>
            </div>
          )}

          {cameraStatus === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-5 text-center text-white">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <ShieldAlert className="h-6 w-6 text-[var(--rally-secondary)]" />
              </div>
              <p className="max-w-xs text-xs leading-relaxed text-white/85">{statusMessage}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-[var(--rally-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:brightness-110"
              >
                <ImageUp className="h-3.5 w-3.5" />
                <span>Choose QR Image</span>
              </button>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => void handleFilePicked(e)}
          className="hidden"
          data-testid="qr_file_input"
        />

        {cameraStatus === 'active' && (
          <div className="flex items-center gap-2 text-xs text-[var(--rally-on-surface-variant)]">
            <Camera className="h-4 w-4 shrink-0 text-[var(--rally-primary)]" />
            <span>{statusMessage}</span>
          </div>
        )}

        {warningMessage && (
          <div
            data-testid="qr_scanner_warning"
            className="rounded-xl border border-[var(--rally-secondary)]/35 bg-[var(--rally-secondary-container)] px-3 py-2 text-xs font-medium text-[var(--rally-on-secondary-container)]"
          >
            {warningMessage}
          </div>
        )}
      </div>
    </ModalDialog>
  );
}
