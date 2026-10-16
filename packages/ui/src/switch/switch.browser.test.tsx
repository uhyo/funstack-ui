// Switch rows that need a real engine (design/components/switch.md section 11: 4b, 21b, the DOM
// half of 26), shared with Checkbox.
import { describeCheckableInputInBrowser } from "../__tests__/checkable-input-browser-suite.js";
import { Switch } from "./index.js";

describeCheckableInputInBrowser({ name: "Switch", Control: Switch, role: "switch" });
