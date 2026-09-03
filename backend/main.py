from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def root():
    return {
        "message": "Creator Content OS backend is running"
    }