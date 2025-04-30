// Extend the Window interface to include our custom properties
interface Window {
  PageTurnAuthClient: ReturnType<typeof createAuthClient>;
}
