/**
 * WebRTC ICE Server Configuration
 * Provides Google public STUN servers by default, and adds custom TURN if configured
 */
const getIceServers = () => {
  const defaultStuns = [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302'
  ];

  const envStuns = process.env.STUN_SERVERS
    ? process.env.STUN_SERVERS.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const allStuns = Array.from(new Set([...envStuns, ...defaultStuns]));

  const iceServers = [
    {
      urls: allStuns
    }
  ];

  if (process.env.TURN_SERVER) {
    const turnConfig = {
      urls: process.env.TURN_SERVER.split(',').map(s => s.trim())
    };
    if (process.env.TURN_USERNAME) {
      turnConfig.username = process.env.TURN_USERNAME;
    }
    if (process.env.TURN_CREDENTIAL) {
      turnConfig.credential = process.env.TURN_CREDENTIAL;
    }
    iceServers.push(turnConfig);
  }

  return iceServers;
};

module.exports = {
  getIceServers
};
