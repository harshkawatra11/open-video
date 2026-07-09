// Loads brand fonts. Swap the imports below for whatever display/body faces the brand kit
// specifies (see @remotion/google-fonts for the full catalog), or delete if system fonts suffice.
import { loadFont as loadDisplay } from "@remotion/google-fonts/Anton";
import { loadFont as loadBody } from "@remotion/google-fonts/Montserrat";

let done = false;
export const loadFonts = () => {
  if (done) return;
  loadDisplay();
  loadBody();
  done = true;
};
