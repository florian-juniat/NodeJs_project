import sys
# insert at 1, 0 is the script path (or '' in REPL)

from surprise import Reader
from surprise import Dataset
from surprise import SVD, accuracy

from surprise.model_selection import train_test_split

from rating_calculator import calculate_rating
from mongo_communications import transform_data

from collections import defaultdict
import pymongo
import pandas as pd


client = pymongo.MongoClient(
    'mongodb+srv://ecommerce.jrfnd.mongodb.net', username='florian', password='ragondin')

db = client["myFirstDatabase"]

users = db["users"]
user_dict = users.find()
user_df = pd.DataFrame.from_dict(user_dict)
print(user_df)


def get_top_n(predictions, n=10):

    top_n = defaultdict(list)
    for uid, iid, true_r, est, _ in predictions:
        top_n[uid].append((iid, est))

    for uid, user_ratings in top_n.items():
        user_ratings.sort(key=lambda x: x[1], reverse=True)
        top_n[uid] = user_ratings[:n]

        return top_n

# users = pd.read_csv("user_info.csv")

courses = pd.read_csv("./python/F21EC/courses_info.csv")
new_user_data = calculate_rating(transform_data(user_df), courses)

# A class that is used to parse a file containing ratings
# It has a structure: user; item; rating;
reader = Reader(rating_scale=(0,20))

# Importing datasets
new_user_data = Dataset.load_from_df(new_user_data[['userId', 'courseId', 'rating']], reader)
train_set, test_set = train_test_split(new_user_data, test_size=0.25)

filter = SVD()

filter.fit(train_set)
predictions = filter.test(test_set)

print("\n\n")
print(predictions)

df = pd.DataFrame(predictions, columns=['uid', 'iid', 'rui', 'est', 'details'])

print("\n\n")
print(df)

print("\n\nRecommendations")
recommendetions = df['iid'].tolist()
print(recommendetions)

print("\n\n")

top_n = get_top_n(predictions, n=10)

for uid, user_ratings in top_n.items():
    print(uid, [iid for (iid, _) in user_ratings])

new_user = user_df.iloc[[-1]]
name = new_user.iloc[0]['name']


db.users.update({"name": name}, {"$set": {"recommended": recommendetions}})

users = db["users"]
user_dict = users.find()
user_df = pd.DataFrame.from_dict(user_dict)
print(user_df)
