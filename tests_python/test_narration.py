import pytest

from backend.narration import narration_text


@pytest.mark.parametrize('caption,spoken',[
    ('166,400원과 166,000원이에요.', '십육만육천사백원과 십육만육천원이에요.'),
    ('6급 과정은 60일, 교재는 8만 원이에요.', '육급 과정은 육십일, 교재는 팔만 원이에요.'),
    ('0원과 10,000원, 100,000,000원이에요.', '영원과 만원, 일억원이에요.'),
    ('3.05%와 1.25배예요.', '삼점영오퍼센트와 일점이오배예요.'),
    ('2026년 6월 10일, 10월 3일이에요.', '이천이십육년 유월 십일, 시월 삼일이에요.'),
    ('2개, 20명, 3시간, 6개월이에요.', '두개, 스무명, 세시간, 육개월이에요.'),
    ('코드 001과 010이에요.', '코드 영영일과 영일영이에요.'),
    ('제2권 3번 문제를 2번 더 풀어요. 12시, 24시예요.', '제이권 삼번 문제를 두번 더 풀어요. 열두시, 이십사시예요.'),
    ('풀이 방법과 풀이 속도를 확인해요.', '풀이 방법과 풀이 속도를 확인해요.'),
])
def test_numerals_preserve_value_units_and_other_words(caption,spoken):
    assert narration_text(caption)==spoken
    assert narration_text(spoken)==spoken


def test_speech_is_rederived_from_edited_caption():
    caption='수강료는 166,000원이에요.'
    assert narration_text(caption)=='수강료는 십육만육천원이에요.'
    assert narration_text(caption.replace('166,000','166,400'))=='수강료는 십육만육천사백원이에요.'
