import { formatTime } from './utils.js';

export function buildChallengeUrl(baseUrl, courseId, targetTime) {
  const url = new URL(baseUrl);
  url.searchParams.set('course', courseId);
  url.searchParams.set('target', targetTime.toFixed(3));
  url.hash = '';
  return url.toString();
}

export function parseChallengeUrl(url, validCourseIds = []) {
  try {
    const parsed = new URL(url);
    const requestedCourse = parsed.searchParams.get('course');
    const target = Number.parseFloat(parsed.searchParams.get('target'));

    return {
      courseId: validCourseIds.includes(requestedCourse) ? requestedCourse : null,
      target: Number.isFinite(target) && target > 0 ? target : null
    };
  } catch (error) {
    return { courseId: null, target: null };
  }
}

export function buildShareText(courseName, time) {
  return `${courseName} cleared in ${formatTime(time)}. Can you beat it?`;
}
