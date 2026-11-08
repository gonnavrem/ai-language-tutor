import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MOCK_MODE } from './dev/mockMode'
import { setupMockMode } from './dev/setup'

async function bootstrap() {
  // Awaited before rendering: Practice requests an exercise on mount, which
  // needs the placeholder provider config to already be in place. A static
  // import, not `import()`: the bundler leaves a dynamic import in the build
  // even when its branch is dead, whereas an unused static import is dropped.
  if (MOCK_MODE) await setupMockMode()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
