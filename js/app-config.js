// Deployment configuration.
// Leave controllerBaseUrl empty when index.html and controller.html are served
// from the same static host. Set it to the public controller URL if they are
// hosted separately.
window.SARDIN_CONFIG = {
  controllerBaseUrl: '',

  // 'auto' = deteksi TV / FPS rendah, 'low' = paksa mode performa,
  // 'high' = paksa kualitas penuh.
  performance: 'auto',

  // Optional PeerJS/WebRTC overrides. Empty object = PeerJS public cloud.
  // Example custom broker:
  // peer: { host: 'peer.example.com', port: 443, secure: true, path: '/' }
  peer: {}
};
