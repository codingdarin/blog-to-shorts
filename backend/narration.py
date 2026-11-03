import re

MAX_NARRATION_LENGTH = 480
DIGITS = '영일이삼사오육칠팔구'


def korean_integer(digits):
    # Leading zeroes identify codes; preserve every digit rather than dropping them.
    if len(digits) > 16 or (len(digits) > 1 and digits.startswith('0')):
        return ''.join(DIGITS[int(digit)] for digit in digits)
    number = int(digits)
    if not number:
        return '영'
    groups = []
    for unit in ('', '만', '억', '조'):
        group, number = number % 10000, number // 10000
        if group:
            part = ''
            for power, small_unit in ((1000, '천'), (100, '백'), (10, '십'), (1, '')):
                digit, group = divmod(group, power)
                if digit:
                    part += ('' if digit == 1 and small_unit else DIGITS[digit]) + small_unit
            groups.append(('' if part == '일' and unit == '만' else part) + unit)
        if not number:
            break
    return ''.join(reversed(groups))


def narration_text(text):
    """Derive speech from current captions; never rewrite names or surrounding facts."""
    def number(match):
        raw = match[0].replace(',', '')
        integer, dot, fraction = raw.partition('.')
        spoken = korean_integer(integer)
        suffix = text[match.end():].lstrip()
        counter = re.match(r'(시간|시(?!험|즌|리즈)|명|개(?!월)|살|권|번째|번(?=\s*(?:씩|더|만|정도|반복|연습|풀)))', suffix)
        if not dot and suffix.startswith('월') and integer in ('6', '10'):
            spoken = '유' if integer == '6' else '시'
        # Korean counters use native numbers below 100; ranks/days/prices use Sino-Korean.
        elif (not dot and counter and not text[:match.start()].rstrip().endswith('제')
              and 0 < int(integer) < 100 and not integer.startswith('0')
              and (counter[0] != '시' or int(integer) <= 12)):
            tens = ('', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔')
            ones = ('', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉')
            value = int(integer)
            spoken = '스무' if value == 20 else tens[value // 10] + ones[value % 10]
        if dot:
            spoken += '점' + ''.join(DIGITS[int(digit)] for digit in fraction)
        return spoken

    return re.sub(r'\d+(?:,\d{3})*(?:\.\d+)?', number, text).replace('%', '퍼센트')
