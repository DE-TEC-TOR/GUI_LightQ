/**
 *  MAIN JS FILE
 *  Contains the main GUI logic, initializes all needed components
 *
 * @author : MattF
 * @company : DE.TEC.TOR.srl
 * @version : 1.0.0
 *
 */
import "./styles/_main.scss";
import * as bootstrap from "bootstrap";
import { default as configs } from "./js/shared/configs";
import { default as WSD } from "./js/websocket/WebSocketDevice";
import { notify } from "./js/core/Helpers";
import { default as init } from "./js/mainPage";

let ws = new WSD(configs);
ws.connect();

$(document).ready(() => {
  init(configs, ws);
  notify("message", "i", 3);
});
