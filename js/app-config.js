// Deployment configuration.
// Leave controllerBaseUrl empty when index.html and controller.html are served
// from the same static host. Set it to the public controller URL if they are
// hosted separately.
window.SARDIN_CONFIG = {
  controllerBaseUrl: '',

  // 'auto' = deteksi TV / FPS rendah, 'low' = paksa mode performa,
  // 'high' = paksa kualitas penuh.
  performance: 'auto',

  // Optional PeerJS/WebRTC overrides. Default includes reliable Google STUN servers.
  peer: {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    }
  }
};
