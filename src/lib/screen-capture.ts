export class ScreenCapture {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private intervalId: any = null;

  async start(onFrame: (base64: string) => void) {
    try {
      if (!navigator.mediaDevices) {
        console.error("Media devices not supported.");
        return false;
      }

      try {
        if (navigator.mediaDevices.getDisplayMedia) {
           this.stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        } else {
           throw new Error("getDisplayMedia not supported");
        }
      } catch (err) {
        console.warn("Screen capture not available, falling back to camera:", err);
        // Fallback to environment camera (rear camera) for mobile devices
        this.stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" }, 
          audio: false 
        });
      }

      this.video = document.createElement("video");
      this.video.srcObject = this.stream;
      await this.video.play();
      this.canvas = document.createElement("canvas");

      const captureFrame = () => {
        if (!this.video || !this.canvas || this.video.videoWidth === 0) return;
        // Limit max resolution to avoid exceeding API payload limits
        const maxDim = 1024;
        let w = this.video.videoWidth;
        let h = this.video.videoHeight;
        
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        this.canvas.width = w;
        this.canvas.height = h;
        const ctx = this.canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(this.video, 0, 0, w, h);
          const dataUrl = this.canvas.toDataURL("image/jpeg", 0.6);
          const base64 = dataUrl.split(",")[1];
          if (base64) onFrame(base64);
        }
      };

      this.intervalId = setInterval(captureFrame, 2000); // 0.5 FPS to save tokens/bandwidth

      // Stop handling
      this.stream.getVideoTracks()[0].onended = () => {
         this.stop();
      };
      
      return true;
    } catch (e: any) {
      console.error("Screen capture error:", e);
      if (e.name === 'NotAllowedError' || e.message.includes('Permission denied')) {
        throw new Error("PERMISSION DENIED");
      }
      return false;
    }
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.intervalId = null;
  }
}
