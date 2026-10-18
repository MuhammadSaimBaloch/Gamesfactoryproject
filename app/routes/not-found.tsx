import { Link } from "react-router";
export function loader() {
  throw new Response("This page could not be found.", { status: 404 });
}
export default function NotFound() {
  return (
    <div className="empty">
      <h1>Out of bounds.</h1>
      <Link to="/">Return home</Link>
    </div>
  );
}
