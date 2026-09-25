import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

function getSecret() {
  const secret =
    process.env.QR_SIGNING_SECRET;

  if (!secret) {
    throw new Error(
      "QR_SIGNING_SECRET belum dikonfigurasi."
    );
  }

  return secret;
}

export function signPresensi(
  value: string
) {
  return createHmac(
    "sha256",
    getSecret()
  )
    .update(value)
    .digest("base64url");
}

export function safeCompare(
  first: string,
  second: string
) {
  try {
    const firstBuffer =
      Buffer.from(first);

    const secondBuffer =
      Buffer.from(second);

    if (
      firstBuffer.length !==
      secondBuffer.length
    ) {
      return false;
    }

    return timingSafeEqual(
      firstBuffer,
      secondBuffer
    );
  } catch {
    return false;
  }
}

export function verifyDynamicQr(
  session: {
    id: string;
    token: string;
  },
  code: string
) {
  const parts =
    code.split(".");

  if (
    parts.length !== 4
  ) {
    return false;
  }

  const [
    issuedAtText,
    expiresAtText,
    nonce,
    signature,
  ] = parts;

  const issuedAt =
    Number(issuedAtText);

  const expiresAt =
    Number(expiresAtText);

  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt)
  ) {
    return false;
  }

  if (
    !nonce ||
    !signature
  ) {
    return false;
  }

  const now =
    Date.now();

  if (
    now >
    expiresAt
  ) {
    return false;
  }

  if (
    issuedAt >
    now + 10000
  ) {
    return false;
  }

  /*
   * Sesuaikan ini jika QR kamu
   * dibuat lebih dari 40 detik.
   */
  if (
    expiresAt -
      issuedAt >
    40000
  ) {
    return false;
  }

  const payload =
    `${session.id}:` +
    `${session.token}:` +
    `${issuedAt}:` +
    `${expiresAt}:` +
    `${nonce}`;

  const expected =
    signPresensi(
      payload
    );

  return safeCompare(
    signature,
    expected
  );
}

/*
 * Ticket stabil setelah QR
 * berhasil divalidasi.
 *
 * Maksimal 5 menit.
 */
export function createCheckinTicket(
  sessionId: string,
  sessionToken: string,
  sessionEndsAt: string
) {
  const sessionEnd =
    new Date(
      sessionEndsAt
    ).getTime();

  const expiresAt =
    Math.min(
      Date.now() +
        5 *
          60 *
          1000,

      sessionEnd
    );

  const nonce =
    randomUUID();

  const payload =
    `${sessionId}:` +
    `${sessionToken}:` +
    `${expiresAt}:` +
    `${nonce}:checkin`;

  const signature =
    signPresensi(
      payload
    );

  return (
    `${expiresAt}.` +
    `${nonce}.` +
    `${signature}`
  );
}

export function verifyCheckinTicket(
  sessionId: string,
  sessionToken: string,
  ticket: string
) {
  if (!ticket) {
    return false;
  }

  const parts =
    ticket.split(".");

  if (
    parts.length !== 3
  ) {
    return false;
  }

  const [
    expiresAtText,
    nonce,
    signature,
  ] = parts;

  const expiresAt =
    Number(
      expiresAtText
    );

  if (
    !Number.isFinite(
      expiresAt
    )
  ) {
    return false;
  }

  if (
    Date.now() >
    expiresAt
  ) {
    return false;
  }

  if (
    !nonce ||
    !signature
  ) {
    return false;
  }

  const payload =
    `${sessionId}:` +
    `${sessionToken}:` +
    `${expiresAt}:` +
    `${nonce}:checkin`;

  const expected =
    signPresensi(
      payload
    );

  return safeCompare(
    signature,
    expected
  );
}