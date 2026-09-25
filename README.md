# Greenwick Terminal Web

Static merchant website for GitHub Pages. It follows the supplied desktop Terminal, Transactions, Reports and Payouts references. It shares **the existing Supabase project and migrations 007–009** with the separate Android Greenwick Bank and Terminal apps. No database service key or server process is needed in the website.

## Payment flow

1. Merchant signs in with Supabase Auth and registers a Greenwick merchant if needed.
2. Products or a custom amount form a sale. Products are saved only in this browser, per merchant. Prices are final GUD amounts; tax and tips are not added.
3. The site creates a random 16-byte token and sends its SHA-256 digest and amount to the same `greenwick_create_terminal_request` RPC as Android Terminal. It locally renders a QR code and Code 39 barcode with `GW1-` plus the uppercase hex token. A plain 32-character code remains as a fallback. The request expires in two minutes.
4. Customer scans either symbol or enters the code in the updated Android Bank 0.7.0 app under Payments → Nearby pay. Bank calls `greenwick_preview_request`, displays the server's merchant and amount, then requires explicit approval via `greenwick_approve_terminal_request`.
5. The web site polls `greenwick_terminal_request_status`, shows the confirmed receipt, and refreshes its ledger-backed Transactions and Reports. Refunds use `greenwick_refund_terminal_payment`.

The browser cannot advertise the BLE service used by the native Android Terminal. QR, barcode and manual code resolve **the same server request and ledger**, and customers must approve it in Bank. Symbol generation is local; the token is not sent to a third-party QR service. The wide Code 39 barcode may require a large display or landscape mode; QR is recommended on phones. Google code scanner in Bank depends on Google Play services, so manual code remains available. Never treat physical proximity or knowledge of a token as approval.

## Put it on GitHub Pages

1. If you have not yet applied migration 007, run its complete contents **once** in your existing Supabase project's SQL Editor, after 006. Then run the contents of `008_same_owner_terminal_payment.sql` and `009_deferred_ledger_trigger_permissions.sql` in order. Keep RLS enabled. If 008 is already installed, run **only 009**.
2. Create a **new repository for this web app**. Upload the contents of this folder to its repository root, including `.nojekyll` and `.github/workflows/pages.yml`. Keep the Android apps in their own projects.
3. In repository **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source. Push to the repository's default branch; the included workflow publishes this static site. You can also serve the repository root directly from a branch if you remove the workflow and select branch publishing instead.
4. Open the Pages HTTPS URL, sign in with a Greenwick account, and register the merchant. Use Bank 0.7.0 on an Android phone with a funded personal wallet. The customer may be a separate user or, for a closed-network test, the merchant owner using a different personal wallet. Test a small QR payment, barcode payment and refund before public use.
5. For email-confirmed signup or recovery links, configure the actual Pages URL as an allowed redirect URL in Supabase Auth. This app uses password login and does not yet offer an in-app password recovery screen.

### Checking an updated deployment

The login screen must show **Web build 0.2.0**. If it does not, the repository or browser is still serving older files. Replace the actual site files in the published repository root (uploading the ZIP itself does not update those files), wait for the Pages deployment to finish, then hard refresh the page with Ctrl+Shift+R.

Do not place a database password, secret key or service role key in this repository. The included Supabase publishable key is public by design; the database RPCs enforce owner checks, transaction locking and RLS. GitHub Pages hosts files only: it cannot run private backend code. Use separate approved server endpoints if external payout or true web card acceptance is added later.

## Verify

Run `npm test` (Node 20 or newer). Open `index.html` through a local web server or GitHub Pages, not `file://`, for browser testing. Test signup and saved session, payment approval, cancellation, expiry, insufficient funds, frozen card, refund once and a second attempt, suspended merchant, unsupported browser, narrow screens and network loss. The report and transaction views use the **100 most recent merchant ledger movements** returned by migration 007; they are not a full statement. Products are local browser data and do not sync to Supabase. Payouts and external card methods are intentionally unavailable.

This source has not been live-tested against your Supabase account or two physical devices. Complete the tests, merchant admission process and security review before using it with material GUD balances.

The self-hosted QR encoder under `vendor/` is based on qrcode-terminal's QRCode implementation by Kazuhiko Arase; its license is included in `vendor/LICENSE-qrcode-terminal.txt`. The Code 39 SVG renderer is part of this project.
