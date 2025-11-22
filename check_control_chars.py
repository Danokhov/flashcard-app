import json
import re

with open('words.json', 'r', encoding='utf-8') as f:
    content = f.read()

# Ищем управляющие символы (ASCII 0-31, кроме пробелов, табов, переводов строк)
control_chars = []
for i, char in enumerate(content):
    code = ord(char)
    if code < 32 and char not in ['\n', '\r', '\t']:
        control_chars.append((i, code, repr(char)))

if control_chars:
    print(f'Найдено {len(control_chars)} управляющих символов:')
    for pos, code, char in control_chars[:20]:
        # Находим контекст
        start = max(0, pos - 50)
        end = min(len(content), pos + 50)
        context = content[start:end]
        print(f'\nПозиция {pos}, код {code}: {char}')
        print(f'Контекст: {repr(context)}')
else:
    print('Управляющих символов не найдено')

# Проверяем, есть ли переносы строк внутри значений
print('\n--- Проверка структуры ---')
try:
    data = json.loads(content)
    print(f'JSON парсится корректно: {len(data)} записей')
except Exception as e:
    print(f'Ошибка: {e}')
