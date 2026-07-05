import { AuthGate } from './components/AuthGate';

export default function App() {
  return (
    <AuthGate>
      <h1>Your Day</h1>
    </AuthGate>
  );
}
