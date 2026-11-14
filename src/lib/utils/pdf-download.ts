/**
 * Standard PDF Download Utility
 * Handles authenticated PDF downloads with content-type verification,
 * filename preservation from Content-Disposition, and memory cleanup.
 */

export interface DownloadPdfProgress {
  percent: number;
  stage: string;
}

export interface DownloadPdfOptions {
  url: string;
  defaultFilename?: string;
  onError?: (error: Error | string) => void;
  onSuccess?: (filename: string) => void;
  onProgress?: (progress: DownloadPdfProgress) => void;
}

export interface DownloadPdfResult {
  success: boolean;
  filename?: string;
  error?: string;
}

export async function downloadPdfFile(options: DownloadPdfOptions): Promise<DownloadPdfResult> {
  const { url, defaultFilename = 'download.pdf', onError, onSuccess, onProgress } = options;

  let currentPercent = 12;
  onProgress?.({ percent: 12, stage: 'Connecting to server...' });

  // Progressive timer while server compiles evaluation data and renders PDFKit
  const progressTimer = setInterval(() => {
    if (currentPercent < 88) {
      const step = currentPercent < 40 ? 7 : currentPercent < 65 ? 4 : 2;
      currentPercent += step;
      let stage = 'Compiling analytics data...';
      if (currentPercent > 30 && currentPercent <= 58) {
        stage = 'Rendering vector tables & typography...';
      } else if (currentPercent > 58 && currentPercent <= 80) {
        stage = 'Applying security watermark & branding...';
      } else if (currentPercent > 80) {
        stage = 'Finalizing document stream...';
      }
      onProgress?.({ percent: currentPercent, stage });
    }
  }, 110);

  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/pdf, application/json, text/plain',
      },
    });

    clearInterval(progressTimer);

    if (!res.ok) {
      let errMsg = `PDF request failed with status ${res.status} (${res.statusText})`;
      try {
        const errJson = await res.json();
        errMsg = errJson.error || errJson.message || errJson.detail || errMsg;
      } catch {
        const text = await res.text();
        if (text && text.length < 200) errMsg = text;
      }
      const error = new Error(errMsg);
      onError?.(error);
      return { success: false, error: errMsg };
    }

    const contentType = res.headers.get('content-type') || '';
    // Verify it is actually a PDF stream and not an HTML error or JSON payload
    if (!contentType.includes('application/pdf') && !contentType.includes('application/octet-stream')) {
      let errorText = 'Unexpected response format received instead of PDF.';
      try {
        const json = await res.json();
        errorText = json.error || json.message || errorText;
      } catch {
        const text = await res.text();
        if (text && text.length < 200) errorText = text;
      }
      const error = new Error(errorText);
      onError?.(error);
      return { success: false, error: errorText };
    }

    // Stream reading
    const contentLength = res.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
    let blob: Blob;

    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const chunks: BlobPart[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          if (totalBytes > 0) {
            const streamPct = Math.min(96, Math.round(88 + (receivedBytes / totalBytes) * 8));
            onProgress?.({ percent: streamPct, stage: 'Transferring PDF bytes...' });
          } else {
            onProgress?.({ percent: 93, stage: 'Receiving document payload...' });
          }
        }
      }
      blob = new Blob(chunks, { type: 'application/pdf' });
    } else {
      blob = await res.blob();
    }

    if (blob.size === 0) {
      const error = new Error('Received an empty PDF file.');
      onError?.(error);
      return { success: false, error: 'Empty file' };
    }

    // Snap to 100%
    onProgress?.({ percent: 100, stage: 'Download complete! Saving to device...' });

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;

    // Parse filename from Content-Disposition header if provided by server
    const disposition = res.headers.get('content-disposition');
    let filename = defaultFilename;
    if (disposition) {
      // Handle standard filename="foo.pdf" and UTF-8 filename*=UTF-8''foo.pdf
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;\s]+)/i);
      if (utf8Match && utf8Match[1]) {
        try {
          filename = decodeURIComponent(utf8Match[1]);
        } catch {
          filename = utf8Match[1];
        }
      } else {
        const match = disposition.match(/filename="?([^";\n]+)"?/i);
        if (match && match[1]) {
          filename = match[1].trim();
        }
      }
    }

    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revoke object URL after delay to release memory
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 2000);

    onSuccess?.(filename);
    return { success: true, filename };
  } catch (err: any) {
    clearInterval(progressTimer);
    const message = err?.message || 'Network error occurred while downloading PDF.';
    onError?.(message);
    return { success: false, error: message };
  }
}
