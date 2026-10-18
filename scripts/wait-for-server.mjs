for (let i = 0; i < 60; i++) {
  try {
    const response = await fetch("http://127.0.0.1:5173");
    if (response.ok) process.exit(0);
  } catch {
    /* Server is still starting. */
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
throw Error("Preview did not start within 60 seconds");
