require('dotenv').config({ path: '.env.local' });
const { resendConfirmationEmail } = require('./app/actions/resend-confirmation.ts');
// This is a TS file, so we can't just require it in node without ts-node or similar.
// Let's use a Next.js environment script or just run it via npx ts-node
