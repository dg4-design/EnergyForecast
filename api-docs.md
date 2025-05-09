# 使用状況データの取得

GraphQL API を使用して、電気使用量グラフの表示に使用されている使用量データを取得することができます。

使用状況データの取得には、次の 2 つのステップがあります

1. 認証トークンの取得
2. 認証トークンを用いた使用状況データの取得

## 認証トークンの取得

GraphQL Interface を使用して、お客様のアカウントの使用状況データを取得するデモを行います。

```
mutation login($input: ObtainJSONWebTokenInput!) {
  obtainKrakenToken(input: $input) {
    token
    refreshToken
  }
}
```

ここで必要なクエリ変数は、マイページにログインする際に使用する "email" と "password" です。

```
{
  "input": {
    "email": "taro@takoenergy.co.jp",
    "password": "xxxxxxxx"
  }
}
```

以下のようなレスポンスが表示されます。

```
{
  "data": {
    "obtainKrakenToken": {
      "token": "eyJxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxkmE",
      "refreshToken": "30xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxb4"
    }
  }
}
```

"token" と "refreshToken" の両方の値をメモしておいてください。

## 使用状況データの取得

```
query halfHourlyReadings(
	$accountNumber: String!
	$fromDatetime: DateTime
	$toDatetime: DateTime
) {
	account(accountNumber: $accountNumber) {
		properties {
			electricitySupplyPoints {
				status
				agreements {
					validFrom
				}
				halfHourlyReadings(
					fromDatetime: $fromDatetime
					toDatetime: $toDatetime
				) {
					...halfHourlyReading
				}
			}
		}
	}
}

fragment halfHourlyReading on ElectricityHalfHourReading {
	consumptionRateBand
	consumptionStep
	costEstimate
	startAt
	value
}
```

クエリ変数には、お客様のアカウント番号と、使用状況データを取得したい日付が含まれます。リクエストは、マイページにログイン後、ご自身の電気使用量グラフページよりブラウザにてディベロッパーツールを開いていただき、Network タブ中の Payload よりご確認いただけます。

```
{
  "accountNumber": "A-41C81B52",
  "fromDatetime": "2022-08-14T15:00:00.000Z",
  "toDatetime": "2022-08-14T17:00:00.000Z"
}
```

リクエストヘッダはこのクエリに必要なものです。以下を追加します。ここでの "Authorization" の値は、"obtainKrakenToken" の変異で取得した "token" の値であることを確認します。

```
{
  "Authorization": "eyJxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxkmE"
}
```

以下のようなレスポンスが表示されます。

```
{
  "data": {
    "account": {
      "properties": [
        {
          "electricitySupplyPoints": [
            {
              "halfHourlyReadings": [
                {
                  "startAt": "2022-08-14T15:00:00+00:00",
                  "endAt": "2022-08-14T15:30:00+00:00",
                  "version": "MONTHLY",
                  "value": "0.20"
                },
                {
                  "startAt": "2022-08-14T15:30:00+00:00",
                  "endAt": "2022-08-14T16:00:00+00:00",
                  "version": "MONTHLY",
                  "value": "0.10"
                },
                {
                  "startAt": "2022-08-14T16:00:00+00:00",
                  "endAt": "2022-08-14T16:30:00+00:00",
                  "version": "MONTHLY",
                  "value": "0.10"
                },
                {
                  "startAt": "2022-08-14T16:30:00+00:00",
                  "endAt": "2022-08-14T17:00:00+00:00",
                  "version": "MONTHLY",
                  "value": "0.00"
                }
              ]
            }
          ]
        }
      ]
    }
  }
}
```

異なる範囲の使用状況データを取得するには、"fromDatetime" と "toDatetime" を変更します。

## トークンの有効期限が切れた際の再認証

認証トークンは発行から 1 時間で期限が切れます。その際は、新しい認証トークンを "obtainKrakenToken" 変数で取得する必要があります。入力には "email" と "password" を再び使用するか、最初に "obtainKrakenToken" ミューテーションを呼び出したときに返された "refreshToken" を使用します。後者の場合、インプットは以下のようになります。

```
{
  "input": {
    "refreshToken": "30xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxb4"
  }
}
```
