import csv
import json

# Читаем существующий words.json
with open('words.json', 'r', encoding='utf-8') as f:
    existing_words = json.load(f)

# Создаем словарь существующих ID для быстрой проверки
existing_ids = {word['id'] for word in existing_words}

print(f"Существующих слов: {len(existing_words)}")
print(f"Существующих ID: {len(existing_ids)}")

# Читаем новый CSV
new_words = []
with open('Export Words1 - Слова (копия).csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        word_id = row['id'].strip()
        
        # Пропускаем если ID уже существует
        if word_id in existing_ids:
            print(f"Пропускаем дубликат: {word_id}")
            continue
        
        # Маппинг топиков
        topic_mapping = {
            'relationships & communication': 'social_relations',
            'house & dwelling': 'home',
            'work & career': 'work'
        }
        
        topic = row['topics'].strip()
        mapped_topic = topic_mapping.get(topic, topic)
        
        # Обработка изображения
        image = row['image'].strip()
        if image and not image.startswith('http'):
            image = f"/images/{image}"
        
        # Парсинг конъюгации
        conjugation_text = row.get('conjugation', '').strip()
        conjugation = None
        if conjugation_text and conjugation_text != '—':
            conjugation_text = conjugation_text.replace('…', '')
            parts = [p.strip() for p in conjugation_text.split(';')]
            if len(parts) == 6:
                conjugation = {
                    "ich": parts[0],
                    "du": parts[1],
                    "er/sie/es": parts[2],
                    "wir": parts[3],
                    "ihr": parts[4],
                    "sie/Sie": parts[5]
                }
        
        # Обработка примеров
        examples_text = row.get('examples', '').strip()
        examples = [examples_text] if examples_text and examples_text != '—' else []
        
        # Обработка перевода
        translation_text = row.get('translation', '').strip()
        translation = [translation_text] if translation_text else []
        
        # Обработка forms
        forms_text = row.get('forms', '').strip()
        forms = [forms_text] if forms_text and forms_text != '—' else []
        
        word_obj = {
            "id": word_id,
            "word": row['word'].strip(),
            "article": row['article'].strip(),
            "gender": row.get('gender', '').strip(),
            "partOfSpeech": row.get('partOfSpeech', '').strip(),
            "translation": translation,
            "transcription": row.get('transcription', '').strip(),
            "transcriptionRu": row.get('transcriptionRu', '').strip(),
            "plural": row.get('plural', '').strip(),
            "examples": examples,
            "association": row.get('association', '').strip(),
            "image": image,
            "topics": [mapped_topic] if mapped_topic else [],
            "level": row.get('level', '').strip(),
            "forms": forms,
            "conjugation": conjugation
        }
        
        new_words.append(word_obj)
        print(f"Добавлено новое слово: {word_id}")

print(f"\nНовых слов для добавления: {len(new_words)}")

# Объединяем старые и новые слова
all_words = existing_words + new_words

# Сохраняем
with open('words.json', 'w', encoding='utf-8') as f:
    json.dump(all_words, f, ensure_ascii=False, indent=2)

print(f"\nИтого слов в words.json: {len(all_words)}")
print(f"Старых: {len(existing_words)}, Новых: {len(new_words)}")
