/**
 * Detector monitor page bound events
 *
 * @author : MattF
 * @company : DE.TEC.TOR. srl
 * @version : 1.0.0
 */
import { notify } from "../../core/Helpers";
export let list = {};

const start_download = () => {
  document.getElementById("download_zip").click();
  notify("Download ongoing ... Plese wait", "i", 3);
  document.getElementById("download_zip").remove();
  return;
};
list["start_download"] = start_download;

// -------------------------------- EVENTS SHARED BETWEEN PAGES -----------------------------------//
// Handle user disconnection
export const disconnected = (sidebar) => {
  sidebar.disconnect();
};

//load a calibration file from local machine
export const load_calib_file = (input, sidebar, mode) => {
  sidebar.uploadCalibFile(input, mode);
};
