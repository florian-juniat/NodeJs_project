import pandas as pd

def transform_data(user_dataframe):
    columns = ['user', 'IT', 'BI', 'DS', 'DE', 'BC', 'EC',
               'HE', 'BSC', 'MSC', 'PHD', 'POSTDOC', 'PI', 'EDU', 'CD']
    transformed_df = pd.DataFrame(columns=columns)
    user_info = []
    new_user = user_dataframe.iloc[[-1]]

    user_info.append(new_user.iloc[0]['name'])

    if new_user.iloc[0]['interest'] == "Informational Technology":
        user_info.append('1')
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
    if new_user.iloc[0]['interest'] == "Business Intelligence":
        user_info.append('0')
        user_info.append('1')
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
    if new_user.iloc[0]['interest'] == "Data Science":
        user_info.append('0')
        user_info.append('0')
        user_info.append('1')
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
    if new_user.iloc[0]['interest'] == "Digital Economics":
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
        user_info.append('1')
        user_info.append('0')
        user_info.append('0')
    if new_user.iloc[0]['interest'] == "biological Computing":
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
        user_info.append('1')
        user_info.append('0')
    if new_user.iloc[0]['interest'] == "E-commerce":
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
        user_info.append('1')

    if new_user.iloc[0]['education'] == "Higher Education":
        user_info.append('1')
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
    if new_user.iloc[0]['education'] == "Bachelors":
        user_info.append('0')
        user_info.append('1')
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
    if new_user.iloc[0]['education'] == "Masters":
        user_info.append('0')
        user_info.append('0')
        user_info.append('1')
        user_info.append('0')
        user_info.append('0')
    if new_user.iloc[0]['education'] == "PhD":
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
        user_info.append('1')
        user_info.append('0')
    if new_user.iloc[0]['education'] == "Postdoctorate":
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
        user_info.append('0')
        user_info.append('1')

    if new_user.iloc[0]['reason'] == "Person Interest":
        user_info.append('1')
        user_info.append('0')
        user_info.append('0')
    if new_user.iloc[0]['reason'] == "Educational":
        user_info.append('0')
        user_info.append('1')
        user_info.append('0')
    if new_user.iloc[0]['reason'] == "Career Development":
        user_info.append('0')
        user_info.append('0')
        user_info.append('1')

    df_length = len(transformed_df)
    transformed_df.loc[df_length] = user_info

    return transformed_df
