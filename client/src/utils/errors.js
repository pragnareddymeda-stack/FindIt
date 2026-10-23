/** Turns an Axios error into a message that tells the user what to do next. */
export function getErrorMessage(err) {
  if (err?.response?.data?.message) {
    const first = err.response.data.details?.[0]?.message;
    return first ? `${err.response.data.message}: ${first}` : err.response.data.message;
  }
  return 'Could not reach the server. Check your connection and try again.';
}
