/**
 * Realistic FxTwitter and VxTwitter API response fixtures for deterministic acceptance tests.
 */

const AVATAR_URL = 'https://pbs.twimg.com/profile_images/1000/avatar_normal.png';
const THUMB_URL = 'https://pbs.twimg.com/ext_tw_video_thumb/1001/pu/img/thumb.png';

function fxSingleVideo(id = '1890000000000000001') {
  return {
    code: 200,
    message: 'OK',
    tweet: {
      id,
      text: 'Checking out this awesome portrait video clip #testing',
      author: {
        name: 'Test Creator',
        screen_name: 'testcreator',
        avatar_url: AVATAR_URL,
      },
      media: {
        videos: [
          {
            type: 'video',
            width: 720,
            height: 1280,
            duration: 24,
            thumbnail_url: THUMB_URL,
            url: `https://video.twimg.com/ext_tw_video/${id}/pu/vid/avc1/720x1280/high.mp4`,
            variants: [
              {
                content_type: 'application/x-mpegURL',
                url: `https://video.twimg.com/ext_tw_video/${id}/pu/pl/master.m3u8`,
              },
              {
                content_type: 'video/mp4',
                bitrate: 632000,
                url: `https://video.twimg.com/ext_tw_video/${id}/pu/vid/avc1/360x640/low.mp4`,
              },
              {
                content_type: 'video/mp4',
                bitrate: 950000,
                url: `https://video.twimg.com/ext_tw_video/${id}/pu/vid/avc1/540x960/mid.mp4`,
              },
              {
                content_type: 'video/mp4',
                bitrate: 2176000,
                url: `https://video.twimg.com/ext_tw_video/${id}/pu/vid/avc1/720x1280/high.mp4`,
              },
            ],
          },
        ],
      },
    },
  };
}

function fxLandscapeVideo(id = '1890000000000000002') {
  return {
    code: 200,
    message: 'OK',
    tweet: {
      id,
      text: 'Wide 1080p landscape demo',
      author: {
        name: 'Wide Creator',
        screen_name: 'widecreator',
        avatar_url: AVATAR_URL,
      },
      media: {
        videos: [
          {
            type: 'video',
            width: 1920,
            height: 1080,
            duration: 10,
            thumbnail_url: THUMB_URL,
            variants: [
              {
                content_type: 'video/mp4',
                bitrate: 2176000,
                url: `https://video.twimg.com/ext_tw_video/${id}/pu/vid/avc1/1280x720/hd.mp4`,
              },
              {
                content_type: 'video/mp4',
                bitrate: 6000000,
                url: `https://video.twimg.com/ext_tw_video/${id}/pu/vid/avc1/1920x1080/fhd.mp4`,
              },
            ],
          },
        ],
      },
    },
  };
}

function fxMultiVideo(id = '1890000000000000003') {
  return {
    code: 200,
    message: 'OK',
    tweet: {
      id,
      text: 'Two clips in one post',
      author: {
        name: 'Multi Poster',
        screen_name: 'multiposter',
        avatar_url: AVATAR_URL,
      },
      media: {
        videos: [
          {
            type: 'video',
            width: 720,
            height: 1280,
            duration: 18,
            thumbnail_url: THUMB_URL,
            variants: [
              {
                content_type: 'video/mp4',
                bitrate: 2176000,
                url: `https://video.twimg.com/ext_tw_video/${id}/pu/vid/avc1/720x1280/clip1.mp4`,
              },
            ],
          },
          {
            type: 'gif',
            width: 480,
            height: 480,
            duration: 2,
            thumbnail_url: THUMB_URL,
            variants: [
              {
                content_type: 'video/mp4',
                bitrate: 0,
                url: `https://video.twimg.com/tweet_video/${id}_clip2.mp4`,
              },
            ],
          },
        ],
      },
    },
  };
}

function fxGifPost(id = '1890000000000000004') {
  return {
    code: 200,
    message: 'OK',
    tweet: {
      id,
      text: 'Reaction GIF post',
      author: {
        name: 'GIF Maker',
        screen_name: 'gifmaker',
        avatar_url: AVATAR_URL,
      },
      media: {
        videos: [
          {
            type: 'gif',
            width: 320,
            height: 240,
            duration: 1,
            thumbnail_url: THUMB_URL,
            variants: [
              {
                content_type: 'video/mp4',
                bitrate: 0,
                url: `https://video.twimg.com/tweet_video/${id}.mp4`,
              },
            ],
          },
        ],
      },
    },
  };
}

function fxQuotedVideo(id = '1890000000000000005') {
  return {
    code: 200,
    message: 'OK',
    tweet: {
      id,
      text: 'Look at this quoted clip!',
      author: {
        name: 'Quoter',
        screen_name: 'quoter',
        avatar_url: AVATAR_URL,
      },
      media: {},
      quote: {
        id: '1890000000000000099',
        text: 'Original quoted video caption',
        author: {
          name: 'Original Author',
          screen_name: 'origauthor',
          avatar_url: AVATAR_URL,
        },
        media: {
          videos: [
            {
              type: 'video',
              width: 720,
              height: 1280,
              duration: 12,
              thumbnail_url: THUMB_URL,
              variants: [
                {
                  content_type: 'video/mp4',
                  bitrate: 1800000,
                  url: `https://video.twimg.com/ext_tw_video/${id}/pu/vid/avc1/720x1280/quoted.mp4`,
                },
              ],
            },
          ],
        },
      },
    },
  };
}

function fxHlsOnly(id = '1890000000000000006') {
  return {
    code: 200,
    message: 'OK',
    tweet: {
      id,
      text: 'Live broadcast replay (HLS only)',
      author: {
        name: 'Broadcaster',
        screen_name: 'broadcaster',
        avatar_url: AVATAR_URL,
      },
      media: {
        videos: [
          {
            type: 'video',
            width: 1280,
            height: 720,
            duration: 3600,
            thumbnail_url: THUMB_URL,
            url: `https://video.twimg.com/ext_tw_video/${id}/pu/pl/live.m3u8`,
            variants: [
              {
                content_type: 'application/x-mpegURL',
                url: `https://video.twimg.com/ext_tw_video/${id}/pu/pl/live.m3u8`,
              },
            ],
          },
        ],
      },
    },
  };
}

function fxPhotoGallery(id = '1890000000000000007') {
  return {
    code: 200,
    message: 'OK',
    tweet: {
      id,
      text: 'Two crisp photos from the trip',
      author: {
        name: 'Photographer',
        screen_name: 'photog',
        avatar_url: AVATAR_URL,
      },
      media: {
        photos: [
          {
            url: `https://pbs.twimg.com/media/${id}_1.jpg?name=medium`,
            width: 1200,
            height: 800,
            altText: 'Mountain sunrise view',
          },
          {
            url: `https://pbs.twimg.com/media/${id}_2.jpg?name=large`,
            width: 1600,
            height: 1200,
            altText: 'Lake reflection at dusk',
          },
        ],
      },
    },
  };
}

function fxTextOnly(id = '1890000000000000008') {
  return {
    code: 200,
    message: 'OK',
    tweet: {
      id,
      text: 'Just a plain text post with no attachments.',
      author: {
        name: 'Text Author',
        screen_name: 'textauthor',
        avatar_url: AVATAR_URL,
      },
      media: {},
    },
  };
}

function vxVideoFallback(id = '1890000000000000009') {
  return {
    tweetID: id,
    user_name: 'Backup User',
    user_screen_name: 'backupuser',
    user_profile_image_url: AVATAR_URL,
    text: 'Recovered cleanly via VxTwitter backup endpoint',
    media_extended: [
      {
        type: 'video',
        url: `https://video.twimg.com/ext_tw_video/${id}/pu/vid/avc1/720x1280/vx_backup.mp4`,
        thumbnail_url: THUMB_URL,
        duration_millis: 15000,
        size: { width: 720, height: 1280 },
      },
    ],
  };
}

module.exports = {
  AVATAR_URL,
  THUMB_URL,
  fxSingleVideo,
  fxLandscapeVideo,
  fxMultiVideo,
  fxGifPost,
  fxQuotedVideo,
  fxHlsOnly,
  fxPhotoGallery,
  fxTextOnly,
  vxVideoFallback,
};
