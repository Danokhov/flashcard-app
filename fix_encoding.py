import json

# Читаем файл с правильной кодировкой
with open('words.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Записываем обратно с ensure_ascii=False для сохранения кириллицы
with open('words.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'✓ Исправлена кодировка для {len(data)} слов')
