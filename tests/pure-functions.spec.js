const { test, expect, stubExternalCdns, gotoApp } = require('./helpers/test-utils');
const { fxSingleVideo, fxHlsOnly, fxPhotoGallery, vxVideoFallback } = require('./fixtures/api-fixtures');

test.describe('Pure helper functions', () => {
  test.beforeEach(async ({ appPage }) => {
    await stubExternalCdns(appPage);
    await gotoApp(appPage);
  });

  test('extractTweetDetails parses valid X/Twitter URLs, share text, and bare IDs', async ({ appPage }) => {
    const results = await appPage.evaluate(() => {
      const cases = [
        'https://x.com/user_name/status/1890000000000000001?s=20',
        'https://twitter.com/user_name/status/1890000000000000002',
        'https://mobile.x.com/i/web/status/1890000000000000003',
        'https://fxtwitter.com/someone/status/1890000000000000004/video/1',
        'Check this out! https://x.com/creator/status/1890000000000000005 awesome clip',
        '1890000000000000006',
        'https://example.com/not-a-tweet',
        'javascript:alert(1)',
        '',
      ];
      return cases.map((c) => extractTweetDetails(c));
    });

    expect(results[0]?.id).toBe('1890000000000000001');
    expect(results[1]?.id).toBe('1890000000000000002');
    expect(results[2]?.id).toBe('1890000000000000003');
    expect(results[3]?.id).toBe('1890000000000000004');
    expect(results[4]?.id).toBe('1890000000000000005');
    expect(results[5]?.id).toBe('1890000000000000006');
    expect(results[6]).toBeNull();
    expect(results[7]).toBeNull();
    expect(results[8]).toBeNull();
  });

  test('isTcoShortLink detects shortened t.co links accurately', async ({ appPage }) => {
    const res = await appPage.evaluate(() => ({
      tco: isTcoShortLink('https://t.co/abc123XYZ'),
      xUrl: isTcoShortLink('https://x.com/user/status/1890000000000000001'),
      random: isTcoShortLink('hello world'),
    }));
    expect(res).toEqual({ tco: true, xUrl: false, random: false });
  });

  test('isSafeHttpsUrl blocks non-https and dangerous protocols', async ({ appPage }) => {
    const res = await appPage.evaluate(() => ({
      https: isSafeHttpsUrl('https://video.twimg.com/clip.mp4'),
      http: isSafeHttpsUrl('http://video.twimg.com/clip.mp4'),
      js: isSafeHttpsUrl('javascript:alert(1)'),
      data: isSafeHttpsUrl('data:text/html,<script>alert(1)</script>'),
      empty: isSafeHttpsUrl(''),
      bad: isSafeHttpsUrl('not a url'),
    }));
    expect(res).toEqual({
      https: true,
      http: false,
      js: false,
      data: false,
      empty: false,
      bad: false,
    });
  });

  test('upgradeTwitterImageUrl upgrades pbs.twimg.com image size to orig', async ({ appPage }) => {
    const upgraded = await appPage.evaluate(() => ({
      withName: upgradeTwitterImageUrl('https://pbs.twimg.com/media/ABC123.jpg?format=jpg&name=medium', 'orig'),
      withoutName: upgradeTwitterImageUrl('https://pbs.twimg.com/media/ABC123.jpg', 'orig'),
      nonTwitter: upgradeTwitterImageUrl('https://example.com/pic.jpg', 'orig'),
    }));
    expect(upgraded.withName).toContain('name=orig');
    expect(upgraded.withoutName).toContain('name=orig');
    expect(upgraded.nonTwitter).toBe('https://example.com/pic.jpg');
  });

  test('buildMediaFilename applies template tokens and sanitizes unsafe characters', async ({ appPage }) => {
    const names = await appPage.evaluate(() => {
      appSettings.filenameTemplate = 'X_{handle}_{id}{index}_{res}';
      const basic = buildMediaFilename({
        handle: 'elon/musk:bad*chars?',
        id: '123456',
        index: 0,
        totalCount: 1,
        resLabel: '1080x1920',
        ext: 'mp4',
      });

      const multi = buildMediaFilename({
        handle: 'creator',
        id: '123456',
        index: 1,
        totalCount: 3,
        resLabel: '720x1280',
        ext: 'mp4',
      });

      appSettings.filenameTemplate = '{handle}{index}_{date}';
      const custom = buildMediaFilename({
        handle: 'creator',
        id: '123456',
        index: 2,
        totalCount: 4,
        resLabel: '320x240',
        ext: 'gif',
      });

      return { basic, multi, custom };
    });

    expect(names.basic).not.toMatch(/[/:*?<>|\\]/);
    expect(names.basic).toMatch(/\.mp4$/);
    expect(names.basic).toContain('123456');
    expect(names.basic).toContain('1080x1920');

    expect(names.multi).toBe('X_creator_123456_v2_720x1280.mp4');

    expect(names.custom).toMatch(/^creator_v3_\d{8}\.gif$/);
  });

  test('normalizeFxTwitter and normalizeVxTwitter deduplicate, sort ascending, and reject unsafe URLs', async ({ appPage }) => {
    const fxVideo = fxSingleVideo();
    // Inject a malicious non-https variant to verify sanitizer drops it
    fxVideo.tweet.media.videos[0].variants.push({
      content_type: 'video/mp4',
      bitrate: 99999999,
      url: 'javascript:alert(1)',
    });

    const out = await appPage.evaluate(
      ({ fxVideo, fxHls, fxPhotos, vxBackup }) => ({
        video: normalizeFxTwitter(fxVideo.tweet, 'fallback', false),
        hls: normalizeFxTwitter(fxHls.tweet, 'fallback', false),
        photos: normalizeFxTwitter(fxPhotos.tweet, 'fallback', false),
        vx: normalizeVxTwitter(vxBackup, 'fallback', false),
      }),
      {
        fxVideo,
        fxHls: fxHlsOnly(),
        fxPhotos: fxPhotoGallery(),
        vxBackup: vxVideoFallback(),
      }
    );

    expect(out.video.mediaKind).toBe('video');
    expect(out.video.videos).toHaveLength(1);
    const widths = out.video.videos[0].resolutions.map((r) => r.width);
    expect(widths).toEqual([360, 540, 720]);
    expect(out.video.videos[0].resolutions.every((r) => r.url.startsWith('https://'))).toBe(true);

    expect(out.hls.videos[0].isHlsOnly).toBe(true);
    expect(out.hls.videos[0].hlsUrl).toContain('.m3u8');

    expect(out.photos.mediaKind).toBe('photos');
    expect(out.photos.photos).toHaveLength(2);
    expect(out.photos.photos[0].fullUrl).toContain('name=orig');

    expect(out.vx.mediaKind).toBe('video');
    expect(out.vx.authorHandle).toBe('backupuser');
    expect(out.vx.videos[0].duration).toBe(15);
  });

  test('encodeGif89a produces a valid binary GIF89a stream', async ({ appPage }) => {
    const gifInfo = await appPage.evaluate(() => {
      const w = 16;
      const h = 16;
      const frame1 = new Uint8ClampedArray(w * h * 4);
      const frame2 = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h * 4; i += 4) {
        frame1[i] = 29;
        frame1[i + 1] = 161;
        frame1[i + 2] = 242;
        frame1[i + 3] = 255;

        frame2[i] = 240;
        frame2[i + 1] = 60;
        frame2[i + 2] = 120;
        frame2[i + 3] = 255;
      }
      const bytes = encodeGif89a({ width: w, height: h, frames: [frame1, frame2], delayCs: 10 });
      const header = String.fromCharCode(...bytes.slice(0, 6));
      return {
        length: bytes.length,
        header,
        trailer: bytes[bytes.length - 1],
      };
    });

    expect(gifInfo.header).toBe('GIF89a');
    expect(gifInfo.trailer).toBe(0x3b);
    expect(gifInfo.length).toBeGreaterThan(800);
  });

  test('trimMp4Lossless produces a smaller, valid, playable MP4 with accurate duration', async ({ appPage }) => {
    const { TINY_MP4 } = require('./helpers/test-utils');
    const b64 = TINY_MP4.toString('base64');

    const result = await appPage.evaluate(async (base64Mp4) => {
      const bin = atob(base64Mp4);
      const src = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) src[i] = bin.charCodeAt(i);

      const trimmed = trimMp4Lossless(src.buffer, 0, 0.5);
      if (!trimmed) return { ok: false };

      const head = new Uint8Array(await trimmed.blob.slice(0, 12).arrayBuffer());
      const boxType = String.fromCharCode(head[4], head[5], head[6], head[7]);

      // Verify Chromium's native video decoder plays the remuxed MP4 cleanly
      const blobUrl = URL.createObjectURL(new Blob([trimmed.blob], { type: 'video/mp4' }));
      const vid = document.createElement('video');
      vid.muted = true;
      vid.preload = 'auto';
      vid.src = blobUrl;

      const meta = await new Promise((resolve) => {
        vid.onloadedmetadata = () => resolve({
          loaded: true,
          duration: vid.duration,
          videoWidth: vid.videoWidth,
          videoHeight: vid.videoHeight,
        });
        vid.onerror = () => resolve({ loaded: false });
      });
      URL.revokeObjectURL(blobUrl);

      return {
        ok: true,
        boxType,
        originalBytes: trimmed.originalBytes,
        trimmedBytes: trimmed.trimmedBytes,
        durationSec: trimmed.durationSec,
        meta,
      };
    }, b64);

    expect(result.ok).toBe(true);
    expect(result.boxType).toBe('ftyp');
    expect(result.trimmedBytes).toBeLessThan(result.originalBytes);
    expect(result.meta.loaded).toBe(true);
    expect(result.meta.videoWidth).toBeGreaterThan(0);
    expect(result.meta.videoHeight).toBeGreaterThan(0);
    expect(result.meta.duration).toBeGreaterThan(0.35);
    expect(result.meta.duration).toBeLessThan(0.65);
  });
});
