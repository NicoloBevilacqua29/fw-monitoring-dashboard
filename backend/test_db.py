from queries import get_oracle_instances

df = get_oracle_instances()

print(df)
print(f"\nRighe trovate: {len(df)}")