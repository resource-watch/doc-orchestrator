# 04/12/2019
- Generate more meaningful error messages and pass them along the pipeline to improve visibility to end user.

# 29/11/2019
- Paginate GET tasks endpoint.
- Clear error message when starting a new operation.

# 27/11/2019
- Add error message to dataset when scheduling a new task while an active one exists.

# 27/11/2019
- Modify dataset append so that it adds the newly appended file URLs to the dataset's `sources` list.

# 14/11/2019
- Refactor tests for reliability
- Set CPU and memory quotas on k8s config
- Add liveliness and readiness checks to k8s config
- Format code to match ESLint rules
- Add hooks to validate ESLint rules
- Update ESLint config
- Update node version to 12.x
- Replace npm with yarn
