// Share Wrapped as Image
import html2canvas from 'html2canvas';
import type { WrappedData } from './wrapped-types';
import { devLog, devWarn, logError } from "@utils/logger";


// Export wrapped card as PNG image
export async function exportWrappedAsImage(elementId: string = 'wrapped-share-card'): Promise<Blob | null> {
  const element = document.getElementById(elementId);
  if (!element) {
    logError('[ShareWrapped] Element not found:', elementId);
    return null;
  }

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#18181b', // zinc-900
      scale: 2, // Higher resolution
      logging: false,
      useCORS: true,
      allowTaint: true,
    });

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  } catch (e) {
    logError('[ShareWrapped] Failed to generate image:', e);
    return null;
  }
}

// Share wrapped using native share API or download
export async function shareWrapped(data: WrappedData): Promise<boolean> {
  const blob = await exportWrappedAsImage();
  if (!blob) return false;

  const fileName = `shokaishelf-wrapped-${data.period}.png`;

  // Try native share API first
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], fileName, { type: 'image/png' });

    const shareData = {
      files: [file],
      title: `My ShokaiShelf Wrapped ${data.period}`,
      text: `Check out my anime stats for ${data.type === 'monthly' ? data.period : data.period}! ${data.episodesWatched} episodes watched, ${data.animeCompleted} anime completed.`,
    };

    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        devLog('[ShareWrapped] Shared successfully');
        return true;
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          logError('[ShareWrapped] Share failed:', e);
        }
      }
    }
  }

  // Fallback: Download file
  return downloadBlob(blob, fileName);
}

// Download blob as file
function downloadBlob(blob: Blob, fileName: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    devLog('[ShareWrapped] Downloaded:', fileName);
    return true;
  } catch (e) {
    logError('[ShareWrapped] Download failed:', e);
    return false;
  }
}

// Copy image to clipboard
export async function copyWrappedToClipboard(): Promise<boolean> {
  const blob = await exportWrappedAsImage();
  if (!blob) return false;

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob,
      }),
    ]);
    devLog('[ShareWrapped] Copied to clipboard');
    return true;
  } catch (e) {
    logError('[ShareWrapped] Copy failed:', e);
    return false;
  }
}
