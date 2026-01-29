import csv
import ast  # For safely evaluating the dictionary strings

# Read all lines from the speech_to_text.txt file
with open("speech_to_text.txt", "r", encoding="utf-8") as file:
    lines = file.readlines()

# Prepare data for CSV
data = []
for line in lines:
    try:
        # Convert string representation of dictionary to actual dictionary
        entry = ast.literal_eval(line.strip())
        
        # Extract timestamp and text
        timestamp = entry['timestamp']
        text = entry['text']
        
        # Format timestamp as "start_time-end_time"
        timelape = f"{timestamp[0]}-{timestamp[1]}"
        
        # Add to data list
        data.append([timelape, text])
    except (SyntaxError, ValueError) as e:
        print(f"Error parsing line: {line}")
        print(f"Error details: {e}")

# Write to CSV file
with open("speech_to_text.csv", "w", encoding="utf-8", newline='') as csvfile:
    writer = csv.writer(csvfile)
    # Write header
    writer.writerow(["timelape", "nội dung"])
    # Write data
    writer.writerows(data)

print("CSV file has been created successfully.")