import { Spinner } from 'react-bootstrap';

export default function AdminLoading() {
  return (
    <div className="d-flex justify-content-center py-5">
      <Spinner animation="border" role="status" aria-label="Se încarcă" />
    </div>
  );
}
