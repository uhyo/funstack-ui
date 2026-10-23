import { Progress } from "@funstack/ui/progress";
export default function App() {
  return (<main><Progress.Root value={40}><Progress.Label>Upload</Progress.Label><Progress.Track><Progress.Indicator /></Progress.Track></Progress.Root></main>);
}
