export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const types = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain' };
export function validateSubmission(value) {
  const fail = message => ({ ok: false, message });
  if (!value || typeof value !== 'object' || value.website) return fail('Please check your submission and try again.');
  if (typeof value.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(value.requestId)) return fail('Please refresh the page and try again.');
  if (typeof value.anonymous !== 'boolean' || !['gmail', 'whatsapp'].includes(value.channel)) return fail('Choose a delivery method.');
  const anonymous = value.anonymous;
  if (anonymous && value.channel !== 'gmail') return fail('Anonymous submissions need a Gmail address.');
  const name = anonymous ? '' : (typeof value.name === 'string' ? value.name.trim() : '');
  if (!anonymous && (!name || name.length > 100)) return fail('Please enter your name (up to 100 characters).');
  const contact = typeof value.contact === 'string' ? value.contact.trim() : '';
  if (value.channel === 'gmail' && !/^[^\s@]+@gmail\.com$/i.test(contact)) return fail('Enter a valid Gmail address ending in @gmail.com.');
  if (value.channel === 'whatsapp' && (!/^\+?[\d\s()-]{8,25}$/.test(contact) || contact.replace(/\D/g, '').length < 8 || contact.replace(/\D/g, '').length > 15)) return fail('Enter a valid WhatsApp number including the country code.');
  const requirements = typeof value.requirements === 'string' ? value.requirements.trim() : '';
  if (requirements.length > 5000) return fail('Keep additional requirements within 5,000 characters.');
  const file = value.file;
  if (!file || typeof file.name !== 'string' || file.name.length > 200 || !Number.isInteger(file.size) || file.size < 1 || file.size > MAX_FILE_BYTES || typeof file.base64 !== 'string') return fail('Choose a nonempty file up to 10 MB.');
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !types[ext]) return fail('Choose a PDF, Word document, image, or TXT file.');
  if (file.base64.length !== 4 * Math.ceil(file.size / 3) || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.base64)) return fail('Your file was not read correctly. Please select it again.');
  let head;
  try { head = atob(file.base64.slice(0, 40)); } catch { return fail('Your file could not be decoded. Please select it again.'); }
  const signatures = { pdf: '%PDF-', doc: '\xd0\xcf\x11\xe0', docx: 'PK\x03\x04', png: '\x89PNG\r\n\x1a\n', jpg: '\xff\xd8\xff', jpeg: '\xff\xd8\xff' };
  if (signatures[ext] && !head.startsWith(signatures[ext])) return fail('The file contents do not match its extension. Please upload the original file.');
  // Exact decoded size is verified again in Apps Script before creating a file.
  const expectedSize = (file.base64.length / 4) * 3 - (file.base64.endsWith('==') ? 2 : file.base64.endsWith('=') ? 1 : 0);
  if (expectedSize !== file.size) return fail('Your file size could not be verified. Please select it again.');
  return { ok: true, data: { requestId: value.requestId, anonymous, channel: value.channel, name, contact, requirements, file: { name: file.name.replace(/[^a-zA-Z0-9._ -]/g, '_'), type: types[ext], size: file.size, base64: file.base64 } } };
}
