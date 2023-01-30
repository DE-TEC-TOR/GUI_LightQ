/**
 *  MAIN JS FILE
 *  Contains the main page logic, initializes all needed components
 *
 * @author : MattF
 * @company : DE.TEC.TOR.srl
 * @version : 1.0.0
 *
 */
import favicon from "../../images/LightQ.png";
//---------------------------------------------DETECTOR CONFIGS----------------------------------//
const device_configs = {
  devName: "LightQ",
  ws_address: "192.168.0.38",
  ws_port: "6123",
  hasPos: true,
  hasInt: true,
  hasRng: false,
  hasAnalysis: false,
  hasHV: true,
  hasDots: false,
  nChX: 256,
  nChY: 256,
  nChZ: 0,
  nChInt: 2,
  posPitch: 1,
  rngPitch: 0,
  posResolution: 1,
  rngResolution: 0,
  favicon: favicon,
};

export default device_configs;
