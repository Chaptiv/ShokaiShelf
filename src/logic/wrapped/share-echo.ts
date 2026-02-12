// ShokaiShelf Echo - Share as Image
import html2canvas from 'html2canvas';
import type { EchoData } from './echo-types';

// Helper to fetch image and convert to Base64 Data URL
async function imageToDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('[ShareEcho] Failed to fetch image for DataURL conversion:', url, e);
    return null;
  }
}

// Export echo card as PNG image
export async function exportEchoAsImage(elementId: string = 'echo-share-card'): Promise<Blob | null> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('[ShareEcho] Element not found:', elementId);
    return null;
  }

  // Store original src to restore later
  const originalSrcs = new Map<HTMLImageElement, string>();
  const images = element.querySelectorAll('img');
  
  try {
    // 1. Convert all external images to DataURLs
    const conversions = Array.from(images).map(async (img) => {
      if (img.src.startsWith('http') && !img.src.includes('localhost') && !img.src.includes('127.0.0.1')) {
        originalSrcs.set(img, img.src);
        const dataUrl = await imageToDataUrl(img.src);
        if (dataUrl) {
          img.src = dataUrl;
          // IMPORTANT: Remove crossOrigin if we use DataURL, otherwise it might still taint
          img.removeAttribute('crossOrigin'); 
        }
      }
    });

    await Promise.all(conversions);

    // 2. Wait for DataURL images to be ready (usually instant but good to be safe)
    await Promise.all(Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve; // Continue even if fail
      });
    }));

    // 3. Capture with html2canvas
    const canvas = await html2canvas(element, {
      backgroundColor: '#0f0f1a',
      scale: 2,
      logging: false,
      useCORS: true, // Still keep true, though DataURLs bypass it
      allowTaint: true,
      imageTimeout: 15000,
      removeContainer: true,
      ignoreElements: (element) => element.classList.contains('echo-share-btn')
    });

    return new Promise((resolve) => {
      try {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png', 1.0);
      } catch (e) {
        console.error('[ShareEcho] Canvas toBlob failed:', e);
        resolve(null);
      }
    });

  } catch (e) {
    console.error('[ShareEcho] Failed to generate image:', e);
    return null;
  } finally {
    // 4. Restore original images immediately
    for (const [img, src] of originalSrcs) {
      img.src = src;
    }
  }
}

// Share echo using native share API or download
export async function shareEcho(data: EchoData): Promise<boolean> {
  const blob = await exportEchoAsImage();
  if (!blob) return false;

  const periodFormatted = data.type === 'monthly'
    ? formatMonth(data.period)
    : data.period;

  const fileName = `shokaishelf-echo-${data.user.username}-${data.period}.png`;

  // Try native share API first
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], fileName, { type: 'image/png' });

    const shareData = {
      files: [file],
      title: `${data.user.username}'s ShokaiShelf Echo`,
      text: `My ${periodFormatted} in Anime: ${data.stats.episodesWatched} episodes, ${data.stats.animeCompleted} anime completed. I'm a "${data.persona.name}"!`,
    };

    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        console.log('[ShareEcho] Shared successfully');
        return true;
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error('[ShareEcho] Share failed:', e);
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
    console.log('[ShareEcho] Downloaded:', fileName);
    return true;
  } catch (e) {
    console.error('[ShareEcho] Download failed:', e);
    return false;
  }
}

// Copy image to clipboard
export async function copyEchoToClipboard(): Promise<boolean> {
  const blob = await exportEchoAsImage();
  if (!blob) return false;

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob,
      }),
    ]);
    console.log('[ShareEcho] Copied to clipboard');
    return true;
  } catch (e) {
    console.error('[ShareEcho] Copy failed:', e);
    return false;
  }
}

// Helper to format month
function formatMonth(period: string): string {
  if (!period) return '';
  const [year, month] = period.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
