import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_AUTH_DOMAIN = firebaseConfig.authDomain;

export function isEmbeddedWebView(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Android WebView includes "; wv)" or "Version/x.x Chrome/... Mobile" without standard Chrome features
  const isAndroidWv = /; wv\)/i.test(ua) || /\bAndroid\b.*\bVersion\/[\d.]+\b/i.test(ua);
  const win = window as unknown as {
    ReactNativeWebView?: unknown;
    Capacitor?: unknown;
    cordova?: unknown;
    Android?: unknown;
  };
  return Boolean(
    isAndroidWv ||
      win.ReactNativeWebView ||
      win.Capacitor ||
      win.cordova ||
      win.Android
  );
}

export function isUnsupportedSchemeForFirebaseAuth(): boolean {
  if (typeof window === 'undefined') return false;
  const protocol = window.location.protocol.toLowerCase();
  return protocol !== 'https:' && protocol !== 'http:';
}

export function getAuthFriendlyError(error: unknown): {
  message: string;
  showApkHelp: boolean;
} {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  const rawMessage = error instanceof Error ? error.message : String(error ?? '');

  switch (code) {
    case 'auth/popup-blocked':
      return {
        message:
          'Google Sign-In popup was blocked by this app or browser. Try Redirect Sign-In below or open RallyHub in Chrome.',
        showApkHelp: true,
      };
    case 'auth/operation-not-supported-in-this-environment':
      return {
        message:
          'This APK / WebView environment does not support Firebase web popups or web storage over this protocol. Use a Trusted Web Activity (TWA) or HTTPS URL in Chrome.',
        showApkHelp: true,
      };
    case 'auth/unauthorized-domain': {
      const host = typeof window !== 'undefined' ? window.location.host : 'this domain';
      return {
        message: `Domain "${host}" is not authorized in Firebase Authentication. Add it under Firebase Console -> Authentication -> Settings -> Authorized domains, or load the hosted app URL.`,
        showApkHelp: true,
      };
    }
    case 'auth/network-request-failed':
      return {
        message: 'Network error during Google Sign-In. Check your internet connection and try again.',
        showApkHelp: false,
      };
    case 'auth/internal-error':
      return {
        message:
          'Google Sign-In could not complete inside this app shell. Android WebViews often block Google login (403 disallowed_useragent) — try Redirect Sign-In or open in Chrome.',
        showApkHelp: true,
      };
    default:
      if (/disallowed_useragent/i.test(rawMessage)) {
        return {
          message:
            'Google blocked sign-in inside an embedded Android WebView (403 disallowed_useragent). Open RallyHub in Chrome or package the APK using a Trusted Web Activity (TWA) / Chrome Custom Tabs.',
          showApkHelp: true,
        };
      }
      return {
        message: rawMessage || 'Google Sign-In failed. Please try again.',
        showApkHelp: isEmbeddedWebView(),
      };
  }
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
