import json

try:
    with open('words.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f'JSON валиден: {len(data)} записей')
    
    # Проверяем слова с mnemo=1 в теме health
    health_words = [w for w in data if 'health' in w.get('topics', [])]
    print(f'\nСлов в теме health: {len(health_words)}')
    
    health_mnemo = [w for w in health_words if w.get('mnemo') == 1]
    print(f'Слов с mnemo=1 в health: {len(health_mnemo)}')
    
    for w in health_mnemo:
        assoc = w.get('association', '')
        print(f'  - {w["word"]}: association length = {len(assoc)}')
        
except json.JSONDecodeError as e:
    print(f'Ошибка JSON: {e}')
    print(f'Позиция: {e.pos}, строка {e.lineno}, колонка {e.colno}')
