import numpy as np
import pandas as pd


def calculate_rating(users, courses):
    columns = ['userId', 'courseId', 'rating']
    ratings= []
    user_ratings = pd.DataFrame(columns=columns)
    for i in range(len(users)):



        for j in range(len(courses)):
            profile = []
            x = []
            IT_score = int(users.loc[i, 'IT']) * courses.loc[j, 'IT']
            BI_score = int(users.loc[i, 'BI']) * courses.loc[j, 'BI']
            DS_score = int(users.loc[i, 'DS']) * courses.loc[j, 'DS']
            DE_score = int(users.loc[i, 'DE']) * courses.loc[j, 'DE']
            BC_score = int(users.loc[i, 'BC']) * courses.loc[j, 'BC']
            EC_score = int(users.loc[i, 'EC']) * courses.loc[j, 'EC']
            HE_score = int(users.loc[i, 'HE']) * courses.loc[j, 'HE']
            BSC_score = int(users.loc[i, 'BSC']) * courses.loc[j, 'BSC']
            MSC_score = int(users.loc[i, 'MSC']) * courses.loc[j, 'MSC']
            PHD_score = int(users.loc[i, 'PHD']) * courses.loc[j, 'PHD']
            POSTDOC_score = int(users.loc[i, 'POSTDOC']) * courses.loc[j, 'POSTDOC']
            PI_score = int(users.loc[i, 'PI']) * courses.loc[j, 'PI']
            EDU_score = int(users.loc[i, 'EDU']) * courses.loc[j, 'EDU']
            CD_score = int(users.loc[i, 'CD']) * courses.loc[j, 'CD']
            course_score = IT_score + BI_score + DS_score + DE_score + BC_score + EC_score
            + HE_score + BSC_score + MSC_score + PHD_score + POSTDOC_score + PI_score
            + EDU_score + CD_score
            x.append(users.loc[i, 'user'])
            x.append(courses.loc[j, 'courseid'])
            x.append(course_score)
            profile.append(x)
            user_ratings = user_ratings.append((pd.DataFrame(profile, columns=columns)), ignore_index=True)
    print(user_ratings)
    return user_ratings
