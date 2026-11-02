from typing import TypedDict
from langgraph.graph import StateGraph, START , END

class AgentState(TypedDict):
    player_name: str
    guesses: list[int]
    attempts: int
    lower_bound: int
    upper_bound: int
    answer: int
    counter: int

def setup(state: AgentState):
    state["lower_bound"] = 0
    state["upper_bound"] = 20

    state["answer"] = 14
    state["counter"] = 7

    return state

def guess(state: AgentState):
    l = state["lower_bound"]
    h = state["upper_bound"]

    n = l+h/2

    state["guesses"].append(n)

    return state

def hint(state: AgentState):
    state["counter"] -= 1

    if (state["guesses"][-1]==state["answer"]):
        return END
    else:
        state
        return "guess"


builder = StateGraph(AgentState)

builder.add_node("setup_node",setup)
builder.add_node("guesser",guess)

builder.add_edge(START,"setup_node")
builder.add_edge("guesser","hinter")