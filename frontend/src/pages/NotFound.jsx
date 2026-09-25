import { Link } from 'react-router-dom'
import { Button } from '../components/ui.jsx'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="readout-label">404</div>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link to="/dashboard" className="mt-6">
        <Button variant="primary">Back to dashboard</Button>
      </Link>
    </div>
  )
}
