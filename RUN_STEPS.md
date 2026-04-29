# Lab 010 Run Steps

Replace these before you start:

- In `app/frontend/index.html`, replace `[YOUR NAME]` with your name.
- In `terraform/terraform.tfvars`, replace `aub-abc123` with a globally unique suffix.
- In Git commands, replace `<YOUR-USERNAME>` with your GitHub username.

## 1. Create AWS Infrastructure

```powershell
eksctl create cluster `
  --name cicd-lab `
  --region us-east-1 `
  --nodegroup-name workers `
  --node-type t3.medium `
  --nodes 2 `
  --nodes-min 1 `
  --nodes-max 3 `
  --managed
```

```powershell
kubectl get nodes
```

```powershell
aws ecr create-repository --repository-name k8s-frontend --region us-east-1
aws ecr create-repository --repository-name k8s-backend --region us-east-1
aws ecr describe-repositories --region us-east-1 --query 'repositories[].repositoryName' --output text
```

```powershell
kubectl create namespace dev
kubectl create namespace prod
kubectl get namespaces
```

## 2. Install and Test Locally

```powershell
cd app
npm install
npm test
cd ..
```

Optional integration test locally:

```powershell
docker run -d -p 6379:6379 redis:7-alpine
cd app
npm run test:integration
cd ..
docker ps
docker stop <container-id>
```

## 3. Build and Push Initial Images

```powershell
$env:ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
$env:REGION = "us-east-1"
echo "Account: $env:ACCOUNT_ID"
echo "Region: $env:REGION"
```

```powershell
aws ecr get-login-password --region $env:REGION | docker login --username AWS --password-stdin "$env:ACCOUNT_ID.dkr.ecr.$env:REGION.amazonaws.com"
```

```powershell
docker build -t "$env:ACCOUNT_ID.dkr.ecr.$env:REGION.amazonaws.com/k8s-backend:v1" ./app
docker push "$env:ACCOUNT_ID.dkr.ecr.$env:REGION.amazonaws.com/k8s-backend:v1"
docker build -t "$env:ACCOUNT_ID.dkr.ecr.$env:REGION.amazonaws.com/k8s-frontend:v1" ./app/frontend
docker push "$env:ACCOUNT_ID.dkr.ecr.$env:REGION.amazonaws.com/k8s-frontend:v1"
```

## 4. Seed Dev and Prod

```powershell
kubectl -n dev apply -f manifests/
kubectl -n dev set image deployment/backend backend="$env:ACCOUNT_ID.dkr.ecr.$env:REGION.amazonaws.com/k8s-backend:v1"
kubectl -n dev set image deployment/frontend frontend="$env:ACCOUNT_ID.dkr.ecr.$env:REGION.amazonaws.com/k8s-frontend:v1"

kubectl -n prod apply -f manifests/
kubectl -n prod set image deployment/backend backend="$env:ACCOUNT_ID.dkr.ecr.$env:REGION.amazonaws.com/k8s-backend:v1"
kubectl -n prod set image deployment/frontend frontend="$env:ACCOUNT_ID.dkr.ecr.$env:REGION.amazonaws.com/k8s-frontend:v1"
```

```powershell
kubectl -n dev rollout status deployment/backend --timeout=120s
kubectl -n dev rollout status deployment/frontend --timeout=120s
kubectl -n prod rollout status deployment/backend --timeout=120s
kubectl -n prod rollout status deployment/frontend --timeout=120s
kubectl get pods -n dev
kubectl get pods -n prod
```

## 5. Push Code to GitHub

Create a private empty GitHub repo named `cicd-lab`, then run:

```powershell
git init
git add .
git commit -m "Initial commit: application code and K8s manifests"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/cicd-lab.git
git push -u origin main
git checkout -b dev
git push -u origin dev
```

## 6. Add GitHub Secrets

Repo -> Settings -> Secrets and variables -> Actions -> New repository secret:

```text
AWS_ACCESS_KEY_ID       your IAM access key
AWS_SECRET_ACCESS_KEY   your IAM secret key
AWS_REGION              us-east-1
AWS_ACCOUNT_ID          your 12-digit AWS account ID
EKS_CLUSTER_NAME        cicd-lab
```

## 7. Add GitHub Environments

Repo -> Settings -> Environments:

- Create `dev` with no required reviewers.
- Create `prod` with Required reviewers enabled and yourself selected.

## 8. Trigger Dev Pipeline

```powershell
git checkout dev
git add .
git commit -m "Add CI/CD pipeline"
git push origin dev
```

After it passes, make the visible DEV label:

```powershell
# Edit app/frontend/index.html:
# <h1>CI/CD Lab - YOUR NAME - DEV</h1>
git add .
git commit -m "Add DEV label to frontend for pipeline test"
git push origin dev
```

Verify:

```powershell
kubectl get pods -n dev
$POD = kubectl -n dev get pod -l app=frontend -o jsonpath='{.items[0].metadata.name}'
kubectl -n dev exec $POD -- curl -s localhost:80
kubectl port-forward -n dev svc/frontend-service 8080:80
```

Open `http://localhost:8080`, then press `Ctrl+C` in the terminal when done.

## 9. Trigger Prod Pipeline

```powershell
git checkout main
git merge dev
git push origin main
```

In GitHub Actions, approve the `prod` deployment when it waits.

Verify:

```powershell
kubectl get pods -n prod
$POD = kubectl -n prod get pod -l app=frontend -o jsonpath='{.items[0].metadata.name}'
kubectl -n prod exec $POD -- curl -s localhost:80
```

## 10. Rollback Commands

```powershell
kubectl rollout history deployment/backend -n prod
kubectl rollout history deployment/backend -n prod --revision=2
kubectl rollout undo deployment/backend -n prod
kubectl rollout status deployment/backend -n prod
```

Then revert the bad commit in Git:

```powershell
git log --oneline -5
git revert <bad-commit-sha>
git push origin main
```

## 11. Terraform Demo

Create the backend state resources once:

```powershell
$env:TF_STATE_BUCKET = "cicd-lab-tfstate-aub-abc123"

aws s3api create-bucket --bucket $env:TF_STATE_BUCKET --region us-east-1
aws s3api put-bucket-versioning --bucket $env:TF_STATE_BUCKET --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket $env:TF_STATE_BUCKET --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
aws dynamodb create-table --table-name cicd-lab-tflocks --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH --billing-mode PAY_PER_REQUEST --region us-east-1
```

Uncomment the `backend "s3"` block in `terraform/versions.tf`, fill in your real bucket name, then run:

```powershell
cd terraform
terraform init
terraform fmt
terraform plan
cd ..
```

Push Terraform through a PR:

```powershell
git checkout -b terraform-demo
git add terraform/ .github/workflows/terraform.yml
git commit -m "Add Terraform demo config and pipeline"
git push -u origin terraform-demo
```

Open a PR from `terraform-demo` to `main`. After merge, approve the prod Terraform apply.

## 12. Cleanup

Run this when you are done to stop AWS charges:

```powershell
kubectl delete namespace dev
kubectl delete namespace prod
```

```powershell
cd terraform
terraform destroy -auto-approve
cd ..
```

```powershell
eksctl delete cluster --name cicd-lab --region us-east-1
```

```powershell
aws ecr delete-repository --repository-name k8s-frontend --force --region us-east-1
aws ecr delete-repository --repository-name k8s-backend --force --region us-east-1
```

If you created Terraform remote state:

```powershell
aws s3 rm "s3://$env:TF_STATE_BUCKET" --recursive
aws s3api delete-bucket --bucket $env:TF_STATE_BUCKET
aws dynamodb delete-table --table-name cicd-lab-tflocks --region us-east-1
```

Delete the lab IAM user:

```powershell
aws iam list-access-keys --user-name cicd-lab-github
aws iam delete-access-key --user-name cicd-lab-github --access-key-id <KEY_ID>
aws iam detach-user-policy --user-name cicd-lab-github --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
aws iam delete-user --user-name cicd-lab-github
```
