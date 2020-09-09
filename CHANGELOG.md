## 04/09/2020

- Add username and password support for Elasticsearch connection

# 2.0.0

## 14/08/2020

- Migrate to Elasticsearch 7.x

# v1.1.1

## 13/07/2020

- Add file name to `STATUS_WRITTEN_DATA`, `STATUS_READ_FILE` and `STATUS_READ_DATA` messages tests.

# v1.1.0

## 09/04/2020

- Add node affinity to kubernetes configuration.

# v1.0.0

## 22/01/2020
- Update `rw-doc-importer-messages` to v1.4.0.
- Have TASK_OVERWRITE messages set a dataset's `legend` field.

## 05/12/2019
- Update dataset `sources` with new files on overwrite and concat.
- Add tests to cover dataset overwrite process.

## 04/12/2019
- Generate more meaningful error messages and pass them along the pipeline to improve visibility to end user.

## 29/11/2019
- Paginate GET tasks endpoint.
- Clear error message when starting a new operation.

## 27/11/2019
- Add error message to dataset when scheduling a new task while an active one exists.

## 27/11/2019
- Modify dataset append so that it adds the newly appended file URLs to the dataset's `sources` list.

## 14/11/2019
- Refactor tests for reliability
- Set CPU and memory quotas on k8s config
- Add liveliness and readiness checks to k8s config
- Format code to match ESLint rules
- Add hooks to validate ESLint rules
- Update ESLint config
- Update node version to 12.x
- Replace npm with yarn
