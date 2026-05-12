import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import { DEFAULT_TIME_ZONE } from '../../../utils/config.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.tz.setDefault(DEFAULT_TIME_ZONE);

const TIMESTAMP_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export function generateTimeStamp(): string {
    return dayjs().tz(DEFAULT_TIME_ZONE).format(TIMESTAMP_FORMAT);
}

export function diffFromNow(timestamp: string, unit: dayjs.ManipulateType = 'hours'): number {
    const parsed = dayjs.tz(timestamp, TIMESTAMP_FORMAT, DEFAULT_TIME_ZONE);
    return dayjs().tz(DEFAULT_TIME_ZONE).diff(parsed, unit);
}
export { dayjs };
