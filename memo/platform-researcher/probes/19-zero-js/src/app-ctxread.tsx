import { use } from "react";
import { GroupContext } from "./ctx.js";
function Reader() {
  const v = use(GroupContext);
  return <p>{String(v)}</p>;
}
export default function App() {
  return (<main><GroupContext value="g1"><Reader /></GroupContext></main>);
}
